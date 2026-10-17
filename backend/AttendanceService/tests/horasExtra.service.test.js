const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../src/config/db");
const modelo = require("../src/models/horasExtra.model");
const programacion = require("../src/models/novedades.model");
const empleados = require("../src/services/empleados.service");
const eventos = require("../src/services/eventos.service");
const servicio = require("../src/services/horasExtra.service");
const { ESTADO_HORAS_EXTRA } = require("../src/utils/horasExtra");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const JEFA = "aaaaaaaa-0000-4000-8000-000000000009";
const SUCURSAL = "11111111-1111-4111-8111-111111111111";
const HOY = "2026-10-16";

const marca = (id, tipo, fecha, fechaHora) => ({
  id_marcaje: `${tipo[0]}-${id}-${fecha}`,
  id_empleado: id,
  fecha_jornada: fecha,
  tipo_codigo: tipo,
  fecha_hora_marcaje: new Date(`${fechaHora}:00-04:00`),
});
const turno = (id, fecha, extra = {}) => ({
  id_empleado: id,
  fecha,
  descanso: false,
  id_turno: "bbbbbbbb-0000-4000-8000-000000000001",
  id_rol: null,
  nombre_turno: "Mañana",
  hora_inicio: "08:00:00",
  hora_fin: "16:00:00",
  minutos_refrigerio: 60,
  minutos_tolerancia: 10,
  ...extra,
});

let guardar;

beforeEach(() => {
  mock.restoreAll();
  process.env.MINUTOS_MINIMOS_EXTRA = "15";
  mock.method(modelo, "momentoActual", async () => ({ ahora: new Date(`${HOY}T12:00:00-04:00`), hoy: HOY }));
  mock.method(modelo, "listarFeriados", async () => []);
  mock.method(modelo, "listar", async () => []);
  mock.method(programacion, "listarProgramacion", async () => []);
  mock.method(modelo, "listarMarcajes", async () => []);
  mock.method(modelo, "listarAutorizaciones", async () => []);
  guardar = mock.method(modelo, "guardarCalculos", async (filas) => filas.length);
  mock.method(empleados, "listarPorArea", async () => [
    { id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Cajera", area: "Cajas", activo: true },
  ]);
  mock.method(empleados, "listarPersonal", async () => [
    { id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Cajera", area: "Cajas", activo: true },
    { id_empleado: LUIS, nombre_completo: "Luis Mamani", cargo: "Panadero", area: "Panadería", activo: true },
  ]);
  mock.method(empleados, "obtener", async (id) => (id === JEFA ? { nombres: "Rosa", apellidos: "Choque", activo: true } : null));
});

test("calcula solo jornadas con entrada y salida, con la copia del turno", async () => {
  modelo.listarMarcajes.mock.mockImplementation(async () => [
    marca(ANA, "ENTRADA", "2026-10-14", "2026-10-14T08:00"),
    marca(ANA, "SALIDA", "2026-10-14", "2026-10-14T18:30"),
    marca(LUIS, "ENTRADA", "2026-10-14", "2026-10-14T08:00"),
  ]);
  programacion.listarProgramacion.mock.mockImplementation(async () => [turno(ANA, "2026-10-14")]);
  assert.equal(await servicio.calcular({ desde: "2026-10-14", hasta: "2026-10-14" }), 1);
  const [fila] = guardar.mock.calls[0].arguments[0];
  assert.equal(fila.id_empleado, ANA);
  assert.equal(fila.nombre_turno, "Mañana");
  assert.equal(fila.inicio_programado.toISOString(), "2026-10-14T12:00:00.000Z");
  assert.equal(fila.minutos_ordinarios, 420);
  assert.equal(fila.minutos_extra, 150);
  assert.equal(fila.id_estado_horas_extra, ESTADO_HORAS_EXTRA.PENDIENTE);
  assert.equal(fila.minutos_extra_aprobados, null);
  assert.equal(fila.minutos_extra_simples, 0);
  assert.deepEqual(programacion.listarProgramacion.mock.calls[0].arguments, ["2026-10-14", "2026-10-14", [ANA]]);
});

test("sin marcajes no consulta turnos ni guarda", async () => {
  assert.equal(await servicio.calcular({ desde: "2026-10-14", hasta: "2026-10-14" }), 0);
  assert.equal(programacion.listarProgramacion.mock.callCount(), 0);
  assert.equal(guardar.mock.callCount(), 0);
});

test("en día de descanso o sin turno todo lo trabajado queda por revisar como extra", async () => {
  modelo.listarMarcajes.mock.mockImplementation(async () => [
    marca(ANA, "ENTRADA", "2026-10-14", "2026-10-14T09:00"),
    marca(ANA, "SALIDA", "2026-10-14", "2026-10-14T13:00"),
  ]);
  programacion.listarProgramacion.mock.mockImplementation(async () => [{ ...turno(ANA, "2026-10-14"), descanso: true }]);
  await servicio.calcular({ desde: "2026-10-14", hasta: "2026-10-14" });
  const [fila] = guardar.mock.calls[0].arguments[0];
  assert.equal(fila.nombre_turno, null);
  assert.equal(fila.inicio_programado, null);
  assert.equal(fila.minutos_ordinarios, 0);
  assert.equal(fila.minutos_extra, 240);
});

test("en feriado lo trabajado en el turno se paga doble aunque no haya extra", async () => {
  modelo.listarMarcajes.mock.mockImplementation(async () => [
    marca(ANA, "ENTRADA", "2026-11-02", "2026-11-02T08:00"),
    marca(ANA, "SALIDA", "2026-11-02", "2026-11-02T16:00"),
  ]);
  programacion.listarProgramacion.mock.mockImplementation(async () => [turno(ANA, "2026-11-02")]);
  modelo.listarFeriados.mock.mockImplementation(async () => [{ fecha: "2026-11-02", nombre: "Todos Santos" }]);
  await servicio.calcular({ desde: "2026-11-02", hasta: "2026-11-02" });
  const [fila] = guardar.mock.calls[0].arguments[0];
  assert.equal(fila.es_feriado, true);
  assert.equal(fila.id_estado_horas_extra, ESTADO_HORAS_EXTRA.SIN_EXTRA);
  assert.equal(fila.minutos_feriado, 420);
  assert.equal(fila.minutos_extra_dobles, 420);
});

test("el desglose exige la sucursal y valida fechas, rango y estado", async () => {
  await assert.rejects(servicio.listar({}), (e) => e.estado === 400 && e.detalles.some((d) => d.campo === "id_sucursal"));
  const invalidos = [
    [{ id_sucursal: "x" }, "id_sucursal"],
    [{ id_sucursal: SUCURSAL, desde: "2026-02-30" }, "desde"],
    [{ id_sucursal: SUCURSAL, desde: "2026-10-10", hasta: "2026-10-01" }, "desde"],
    [{ id_sucursal: SUCURSAL, desde: "2026-01-01", hasta: "2026-10-01" }, "desde"],
    [{ id_sucursal: SUCURSAL, estado: "OTRO" }, "estado"],
  ];
  for (const [filtros, campo] of invalidos) {
    await assert.rejects(servicio.listar(filtros), (e) => e.estado === 400 && e.detalles.some((d) => d.campo === campo));
  }
});

test("el desglose calcula antes de leer y empieza el mes en curso por defecto", async () => {
  const datos = await servicio.listar({ id_sucursal: SUCURSAL });
  assert.equal(datos.desde, "2026-10-01");
  assert.equal(datos.hasta, HOY);
  assert.deepEqual(modelo.listarMarcajes.mock.calls[0].arguments, ["2026-10-01", HOY, [ANA]]);
  assert.deepEqual(datos.resumen.jornadas, 0);
});

const filaGuardada = (extra = {}) => ({
  id_horas_jornada: "cccccccc-0000-4000-8000-000000000001",
  id_empleado: ANA,
  fecha_jornada: "2026-10-14",
  es_feriado: false,
  nombre_feriado: null,
  nombre_turno: "Mañana",
  inicio_programado: new Date("2026-10-14T12:00:00Z"),
  fin_programado: new Date("2026-10-14T20:00:00Z"),
  minutos_refrigerio: 60,
  entrada_en: new Date("2026-10-14T12:00:00Z"),
  salida_en: new Date("2026-10-14T22:30:00Z"),
  minutos_trabajados: 630,
  minutos_ordinarios: 420,
  minutos_ordinarios_nocturnos: 0,
  minutos_extra: 150,
  minutos_anticipados: 0,
  id_estado_horas_extra: ESTADO_HORAS_EXTRA.PENDIENTE,
  estado_codigo: "PENDIENTE",
  estado_nombre: "Pendiente de revisión",
  minutos_extra_aprobados: null,
  minutos_extra_simples: 0,
  minutos_extra_dobles: 0,
  minutos_extra_nocturnos: 0,
  minutos_feriado: 0,
  minutos_nocturnos: 0,
  id_periodo: null,
  ...extra,
});

test("el filtro de estado deja el resumen con todas las jornadas del rango", async () => {
  modelo.listar.mock.mockImplementation(async () => [
    filaGuardada(),
    filaGuardada({ id_horas_jornada: "c2", id_estado_horas_extra: 1, estado_codigo: "SIN_EXTRA", minutos_extra: 0 }),
  ]);
  const datos = await servicio.listar({ id_sucursal: SUCURSAL, estado: "pendiente" });
  assert.equal(datos.jornadas.length, 1);
  assert.equal(datos.jornadas[0].empleado.nombre_completo, "Ana Quispe");
  assert.equal(datos.jornadas[0].turno.nombre, "Mañana");
  assert.equal(datos.resumen.jornadas, 2);
  assert.equal(datos.resumen.pendientes, 1);
  assert.equal(datos.resumen.minutos_extra, 150);
});

test("el CSV usa punto y coma, horas con coma decimal y escapa los textos", () => {
  const { nombre, contenido } = servicio.aCsv({
    desde: "2026-10-01",
    hasta: "2026-10-15",
    empleados: [
      {
        empleado: { nombre_completo: 'Ana "La Rápida"; Quispe', cargo: "Cajera", area: "Cajas" },
        jornadas: 2,
        minutos_ordinarios: 840,
        minutos_nocturnos: 90,
        minutos_extra: 150,
        minutos_anticipados: 30,
        minutos_extra_aprobados: 150,
        minutos_extra_simples: 120,
        minutos_extra_dobles: 30,
        minutos_feriado: 0,
        pendientes: 0,
      },
    ],
  });
  assert.equal(nombre, "horas-extra_2026-10-01_2026-10-15.csv");
  assert.ok(contenido.startsWith("﻿Empleado;Cargo;Área;"));
  const [, linea] = contenido.split("\r\n");
  assert.equal(linea, '"Ana ""La Rápida""; Quispe";Cajera;Cajas;2;14,00;1,50;2,00;0,50;0,00;3,00;2,50;0');
});

test("el resumen de toda la empresa calcula para todo el personal", async () => {
  mock.method(modelo, "totalizar", async () => [
    { id_empleado: LUIS, jornadas: 1, minutos_ordinarios: 420, minutos_extra_simples: 60, pendientes: 1 },
    { id_empleado: ANA, jornadas: 2, minutos_ordinarios: 840, minutos_extra_simples: 120, pendientes: 0 },
  ]);
  const datos = await servicio.resumen({ desde: "2026-10-01", hasta: "2026-10-15" });
  assert.deepEqual(modelo.listarMarcajes.mock.calls[0].arguments, ["2026-10-01", "2026-10-15", null]);
  assert.deepEqual(datos.empleados.map((e) => e.empleado.nombre_completo), ["Ana Quispe", "Luis Mamani"]);
  assert.equal(datos.totales.jornadas, 3);
  assert.equal(datos.totales.minutos_extra_simples, 180);
  assert.equal(datos.totales.pendientes, 1);
});

const transaccion = (consultas = []) =>
  mock.method(pool, "connect", async () => ({
    query: async (texto, valores) => {
      consultas.push(texto);
      return { rows: [] };
    },
    release: () => {},
  }));

test("consolidar exige un periodo ya terminado y un responsable válido", async () => {
  const casos = [
    [{}, "desde"],
    [{ desde: "2026-10-01" }, "hasta"],
    [{ desde: "2026-10-01", hasta: HOY }, "hasta"],
    [{ desde: "2026-01-01", hasta: "2026-10-15" }, "desde"],
  ];
  for (const [cuerpo, campo] of casos) {
    await assert.rejects(servicio.consolidar(JEFA, cuerpo), (e) => e.estado === 400 && e.detalles.some((d) => d.campo === campo));
  }
  await assert.rejects(servicio.consolidar("abc", { desde: "2026-10-01", hasta: "2026-10-15" }), { estado: 401 });
  await assert.rejects(servicio.consolidar(LUIS, { desde: "2026-10-01", hasta: "2026-10-15" }), { estado: 403 });
});

test("no consolida con horas extra pendientes de revisión", async () => {
  transaccion();
  mock.method(modelo, "contarPendientes", async () => 2);
  const crear = mock.method(modelo, "crearPeriodo", async () => ({}));
  await assert.rejects(servicio.consolidar(JEFA, { desde: "2026-10-01", hasta: "2026-10-15" }), {
    estado: 409,
    message: "Quedan 2 jornadas con horas extra por revisar en el periodo.",
  });
  assert.equal(crear.mock.callCount(), 0);
});

test("un periodo que se superpone con otro ya consolidado responde 409", async () => {
  transaccion();
  mock.method(modelo, "contarPendientes", async () => 0);
  mock.method(modelo, "crearPeriodo", async () => {
    throw Object.assign(new Error("conflicting key value violates exclusion constraint"), { code: "23P01" });
  });
  await assert.rejects(servicio.consolidar(JEFA, { desde: "2026-10-01", hasta: "2026-10-15" }), {
    estado: 409,
    message: "Ya hay un periodo consolidado que incluye alguno de esos días.",
  });
});

test("al consolidar cierra las jornadas y envía los totales por empleado a compensaciones", async () => {
  transaccion();
  mock.method(modelo, "contarPendientes", async () => 0);
  const periodo = {
    id_periodo: "dddddddd-0000-4000-8000-000000000001",
    fecha_inicio: "2026-10-01",
    fecha_fin: "2026-10-15",
    id_responsable: JEFA,
    nombre_responsable: "Rosa Choque",
    consolidado_en: new Date("2026-10-16T16:00:00Z"),
  };
  mock.method(modelo, "crearPeriodo", async () => periodo);
  mock.method(modelo, "cerrarJornadas", async () => ({ ...periodo, cantidad_jornadas: 3 }));
  mock.method(modelo, "totalizar", async () => [
    { id_empleado: ANA, jornadas: 3, minutos_ordinarios: 1260, minutos_nocturnos: 0, minutos_extra_simples: 120, minutos_extra_dobles: 30, minutos_feriado: 0 },
  ]);
  const registrar = mock.method(eventos, "registrarConsolidacion", async () => {});
  const resultado = await servicio.consolidar(JEFA, { desde: "2026-10-01", hasta: "2026-10-15" });
  assert.equal(resultado.cantidad_jornadas, 3);
  assert.equal(resultado.responsable.nombre_completo, "Rosa Choque");
  const carga = registrar.mock.calls[0].arguments[1];
  assert.equal(carga.evento, "HORAS_EXTRA_CONSOLIDADAS");
  assert.equal(carga.fecha_inicio, "2026-10-01");
  assert.deepEqual(carga.empleados[0], {
    id_empleado: ANA,
    nombre_completo: "Ana Quispe",
    jornadas: 3,
    minutos_ordinarios: 1260,
    minutos_nocturnos: 0,
    minutos_extra_simples: 120,
    minutos_extra_dobles: 30,
    minutos_feriado: 0,
  });
});

test("con autorización previa la jornada se aprueba sola y queda enlazada", async () => {
  modelo.listarMarcajes.mock.mockImplementation(async () => [
    marca(ANA, "ENTRADA", "2026-10-14", "2026-10-14T08:00"),
    marca(ANA, "SALIDA", "2026-10-14", "2026-10-14T18:30"),
  ]);
  programacion.listarProgramacion.mock.mockImplementation(async () => [turno(ANA, "2026-10-14")]);
  modelo.listarAutorizaciones.mock.mockImplementation(async () => [
    { id_autorizacion: "eeeeeeee-0000-4000-8000-000000000001", id_empleado: ANA, fecha_jornada: "2026-10-14", minutos_autorizados: 120 },
  ]);
  await servicio.calcular({ desde: "2026-10-14", hasta: "2026-10-14" });
  const [fila] = guardar.mock.calls[0].arguments[0];
  assert.equal(fila.id_estado_horas_extra, ESTADO_HORAS_EXTRA.AJUSTADA);
  assert.equal(fila.minutos_extra_aprobados, 120);
  assert.equal(fila.minutos_extra_simples, 120);
  assert.equal(fila.id_autorizacion, "eeeeeeee-0000-4000-8000-000000000001");
});

const ID_JORNADA = "cccccccc-0000-4000-8000-000000000001";
const transaccionCon = (fila) => {
  transaccion();
  mock.method(modelo, "bloquear", async () => fila);
  mock.method(modelo, "obtener", async () => fila);
  mock.method(empleados, "obtenerNombre", async () => "Ana Quispe");
  return mock.method(modelo, "registrarRevision", async () => {});
};

test("revisar: aprueba con ajuste y recalcula el pago", async () => {
  const registrar = transaccionCon(filaGuardada({ minutos_extra: 150 }));
  const revisada = await servicio.revisar(ID_JORNADA, JEFA, { decision: "APROBADA", minutos_aprobados: 140, comentario: "Se fue a las 18:20" });
  const [, id, datos] = registrar.mock.calls[0].arguments;
  assert.equal(id, ID_JORNADA);
  assert.equal(datos.idEstado, ESTADO_HORAS_EXTRA.AJUSTADA);
  assert.equal(datos.aprobados, 140);
  assert.equal(datos.pago.minutos_extra_simples, 120);
  assert.equal(datos.pago.minutos_extra_dobles, 20);
  assert.equal(datos.nombreRevisor, "Rosa Choque");
  assert.equal(datos.comentario, "Se fue a las 18:20");
  assert.equal(revisada.empleado.nombre_completo, "Ana Quispe");
});

test("revisar: reglas de la jornada y del revisor", async () => {
  transaccionCon(null);
  await assert.rejects(servicio.revisar("abc", JEFA, { decision: "APROBADA" }), { estado: 404 });
  await assert.rejects(servicio.revisar(ID_JORNADA, JEFA, { decision: "APROBADA" }), { estado: 404 });
  await assert.rejects(servicio.revisar(ID_JORNADA, "abc", { decision: "APROBADA" }), { estado: 401 });
  await assert.rejects(servicio.revisar(ID_JORNADA, LUIS, { decision: "APROBADA" }), { estado: 403 });

  transaccionCon(filaGuardada({ id_empleado: JEFA }));
  await assert.rejects(servicio.revisar(ID_JORNADA, JEFA, { decision: "APROBADA" }), {
    estado: 403,
    message: "No puede revisar sus propias horas extra.",
  });
  transaccionCon(filaGuardada({ id_periodo: "dddddddd-0000-4000-8000-000000000001" }));
  await assert.rejects(servicio.revisar(ID_JORNADA, JEFA, { decision: "APROBADA" }), { estado: 409 });
  transaccionCon(filaGuardada({ id_estado_horas_extra: ESTADO_HORAS_EXTRA.SIN_EXTRA, minutos_extra: 0 }));
  await assert.rejects(servicio.revisar(ID_JORNADA, JEFA, { decision: "APROBADA" }), {
    estado: 409,
    message: "La jornada no tiene horas extra por revisar.",
  });
});

test("autorizar: guarda con el nombre de quien autoriza y recalcula ese día", async () => {
  mock.method(empleados, "obtener", async (id) => ({ nombres: id === JEFA ? "Rosa" : "Ana", apellidos: "Choque", activo: true }));
  const guardarAutorizacion = mock.method(modelo, "guardarAutorizacion", async (datos) => ({
    id_autorizacion: "eeeeeeee-0000-4000-8000-000000000002",
    id_empleado: datos.idEmpleado,
    fecha_jornada: datos.fecha,
    minutos_autorizados: datos.minutos,
    motivo: datos.motivo,
    id_autorizador: datos.idAutorizador,
    nombre_autorizador: datos.nombreAutorizador,
    creada: true,
  }));
  const resultado = await servicio.autorizar(JEFA, { id_empleado: ANA, fecha_jornada: HOY, minutos_autorizados: 90, motivo: "Inventario" });
  assert.equal(guardarAutorizacion.mock.calls[0].arguments[0].nombreAutorizador, "Rosa Choque");
  assert.equal(resultado.creada, true);
  assert.equal(resultado.autorizador.nombre_completo, "Rosa Choque");
  assert.deepEqual(modelo.listarMarcajes.mock.calls[0].arguments, [HOY, HOY, [ANA]]);
});

test("autorizar: nadie se autoriza a sí mismo ni a un colaborador inexistente", async () => {
  const datos = { fecha_jornada: HOY, minutos_autorizados: 60, motivo: "Inventario" };
  await assert.rejects(servicio.autorizar(JEFA, { ...datos, id_empleado: JEFA }), { estado: 403 });
  await assert.rejects(servicio.autorizar(JEFA, { ...datos, id_empleado: LUIS }), { estado: 404 });
  await assert.rejects(servicio.autorizar(JEFA, { ...datos, id_empleado: ANA, fecha_jornada: "2026-10-15" }), { estado: 400 });
});

test("anular una autorización de un día que ya pasó: 409", async () => {
  mock.method(modelo, "obtenerAutorizacion", async () => ({ id_autorizacion: "x", id_empleado: ANA, fecha_jornada: "2026-10-15" }));
  const eliminar = mock.method(modelo, "eliminarAutorizacion", async () => {});
  await assert.rejects(servicio.eliminarAutorizacion("eeeeeeee-0000-4000-8000-000000000002", JEFA), { estado: 409 });
  assert.equal(eliminar.mock.callCount(), 0);
  await assert.rejects(servicio.eliminarAutorizacion("abc", JEFA), { estado: 404 });
});
