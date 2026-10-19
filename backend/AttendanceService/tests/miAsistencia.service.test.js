// RF-28: consulta del historial de asistencia individual.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/miAsistencia.model");
const programacion = require("../src/models/novedades.model");
const justificaciones = require("../src/models/justificaciones.model");
const empleados = require("../src/services/empleados.service");
const horasExtra = require("../src/services/horasExtra.service");
const servicio = require("../src/services/miAsistencia.service");

const HOY = "2026-10-19";
const ANA = "e0000000-0000-4000-8000-000000000002";
const LUIS = "e0000000-0000-4000-8000-000000000003";

const turno = (fecha, descanso = false) => ({
  id_empleado: ANA,
  fecha,
  descanso,
  nombre_turno: descanso ? null : "Mañana",
  hora_inicio: descanso ? null : "08:00:00",
  hora_fin: descanso ? null : "16:00:00",
});

const marcaje = (id, fecha, tipo, hora) => ({
  id_marcaje: id,
  fecha_jornada: fecha,
  fecha_hora_marcaje: new Date(`${fecha}T${hora}-04:00`),
  codigo_dispositivo: null,
  tipo_codigo: tipo,
  origen_codigo: "PORTAL",
  origen_nombre: "Portal",
  estado_codigo: "REGISTRADO",
  estado_nombre: "Registrado",
});

const novedad = (id, fecha, tipo, minutos, estado = "REGISTRADA") => ({
  id_novedad: id,
  fecha_jornada: fecha,
  minutos,
  tipo_codigo: tipo,
  tipo_nombre: tipo,
  es_justificable: tipo !== "OMISION_SALIDA",
  estado_codigo: estado,
  estado_nombre: estado,
});

const solicitud = (idNovedad, estado, creado, extra = {}) => ({
  id_solicitud: `s-${idNovedad}-${estado}`,
  id_novedad: idNovedad,
  estado_codigo: estado,
  estado_nombre: estado,
  motivo_nombre: "Salud o atención médica",
  creado_en: new Date(creado),
  revisada_en: null,
  ...extra,
});

let obtener;
let listarMarcajes;
let calcular;

beforeEach(() => {
  mock.restoreAll();
  mock.method(programacion, "momentoActual", async () => ({ ahora: new Date("2026-10-19T14:00:00Z"), hoy: HOY }));
  obtener = mock.method(empleados, "obtener", async (id) =>
    id === ANA ? { id_empleado: ANA, nombres: "Ana", apellidos: "Quispe", activo: true } : null
  );
  calcular = mock.method(horasExtra, "calcular", async () => 0);
  mock.method(programacion, "listarProgramacion", async () => [
    turno("2026-10-01"),
    turno("2026-10-02"),
    turno("2026-10-03"),
    turno("2026-10-04", true),
    turno("2026-10-05"),
    turno("2026-10-06"),
  ]);
  listarMarcajes = mock.method(modelo, "listarMarcajes", async () => [
    marcaje("m1", "2026-10-01", "ENTRADA", "08:20:15"),
    marcaje("m2", "2026-10-01", "SALIDA", "16:05:00"),
    marcaje("m3", "2026-10-02", "ENTRADA", "08:10:00"),
    marcaje("m4", "2026-10-02", "SALIDA", "16:00:00"),
  ]);
  mock.method(modelo, "listarNovedades", async () => [
    novedad("n1", "2026-10-01", "ATRASO", 15),
    novedad("n2", "2026-10-02", "ATRASO", 5, "JUSTIFICADA"),
    novedad("n3", "2026-10-03", "INASISTENCIA", 450),
    novedad("n4", "2026-10-05", "INASISTENCIA", 450),
  ]);
  mock.method(modelo, "listarHoras", async () => [
    { fecha_jornada: "2026-10-01", minutos_trabajados: 405, minutos_extra_aprobados: 0, estado_extra_codigo: "SIN_EXTRA" },
    { fecha_jornada: "2026-10-02", minutos_trabajados: 470, minutos_extra_aprobados: 30, estado_extra_codigo: "APROBADA", estado_extra_nombre: "Aprobada" },
  ]);
  mock.method(modelo, "listarLicencias", async () => [
    {
      id_solicitud: "l1",
      fecha_inicio: "2026-10-05",
      fecha_fin: "2026-10-05",
      tipo_codigo: "MEDICA",
      tipo_nombre: "Licencia médica",
      estado_codigo: "APROBADA",
      estado_nombre: "Aprobada",
    },
  ]);
  mock.method(justificaciones, "listarPorNovedades", async () => [
    // De la más reciente a la más antigua: en n3 la vigente es la pendiente, no la rechazada anterior.
    solicitud("n3", "PENDIENTE", "2026-10-04T10:00:00Z"),
    solicitud("n2", "APROBADA", "2026-10-02T20:00:00Z", {
      revisada_en: new Date("2026-10-03T12:00:00Z"),
      nombre_revisor: "Sofía Supervisora",
    }),
    solicitud("n3", "RECHAZADA", "2026-10-03T22:00:00Z", { revisada_en: new Date("2026-10-04T09:00:00Z") }),
  ]);
});

const consultarAna = (consulta = { desde: "2026-10-01", hasta: "2026-10-06" }) => servicio.consultar(ANA, consulta);

test("criterio 1: lista cada jornada con la fecha y hora exacta de entrada y salida, de la más reciente a la más antigua", async () => {
  const { dias, empleado } = await consultarAna();
  assert.equal(empleado.nombre_completo, "Ana Quispe");
  assert.deepEqual(dias.map((d) => d.fecha), ["2026-10-06", "2026-10-05", "2026-10-04", "2026-10-03", "2026-10-02", "2026-10-01"]);
  const primero = dias.at(-1);
  assert.equal(primero.entrada.fecha_hora.toISOString(), "2026-10-01T12:20:15.000Z");
  assert.equal(primero.salida.fecha_hora.toISOString(), "2026-10-01T20:05:00.000Z");
  assert.equal(primero.entrada.origen.codigo, "PORTAL");
  assert.deepEqual(primero.turno, { nombre: "Mañana", hora_inicio: "08:00", hora_fin: "16:00", descanso: false });
  assert.equal(primero.minutos_trabajados, 405);
});

test("criterio 2: resume días laborados, atrasos acumulados en minutos, faltas y horas computadas", async () => {
  const { resumen } = await consultarAna();
  assert.equal(resumen.dias_programados, 5);
  assert.equal(resumen.dias_laborados, 2);
  assert.equal(resumen.atrasos, 2);
  assert.equal(resumen.minutos_atraso, 20);
  assert.equal(resumen.minutos_atraso_sin_justificar, 15);
  assert.equal(resumen.atrasos_justificados, 1);
  assert.equal(resumen.faltas, 2);
  assert.equal(resumen.faltas_injustificadas, 2);
  assert.equal(resumen.dias_con_licencia, 1);
  assert.equal(resumen.minutos_trabajados, 875);
  assert.equal(resumen.minutos_extra_aprobados, 30);
});

test("criterio 2: clasifica cada día (laborado, falta, licencia, descanso, sin registro)", async () => {
  const { dias } = await consultarAna();
  const estado = Object.fromEntries(dias.map((d) => [d.fecha, d.estado]));
  assert.deepEqual(estado, {
    "2026-10-01": "LABORADO",
    "2026-10-02": "LABORADO",
    "2026-10-03": "FALTA",
    "2026-10-04": "DESCANSO",
    "2026-10-05": "LICENCIA",
    "2026-10-06": "SIN_REGISTRO",
  });
});

test("criterio 2: filtra por mes y no consulta días posteriores a hoy", async () => {
  const { filtros } = await consultarAna({ mes: "2026-10" });
  assert.deepEqual(filtros, { desde: "2026-10-01", hasta: "2026-10-31", hasta_efectiva: HOY });
  assert.deepEqual(listarMarcajes.mock.calls[0].arguments, [ANA, "2026-10-01", HOY]);
  assert.deepEqual(calcular.mock.calls[0].arguments[0], { desde: "2026-10-01", hasta: HOY, ids: [ANA] });
});

test("criterio 2: sin filtros muestra el mes en curso hasta hoy", async () => {
  const { filtros, dias } = await servicio.consultar(ANA, {});
  assert.deepEqual(filtros, { desde: "2026-10-01", hasta: HOY, hasta_efectiva: HOY });
  assert.equal(dias[0].fecha, HOY);
  assert.equal(dias[0].estado, "SIN_TURNO");
});

test("criterio 2: rechaza filtros inválidos", () => {
  const error = (filtros) => {
    try {
      servicio.leerFiltros(filtros, HOY);
    } catch (e) {
      return { estado: e.estado, campo: e.detalles[0].campo };
    }
    return null;
  };
  assert.deepEqual(error({ mes: "2026-13" }), { estado: 400, campo: "mes" });
  assert.deepEqual(error({ mes: "2026-11" }), { estado: 400, campo: "mes" });
  assert.deepEqual(error({ desde: "2026-10-10", hasta: "2026-10-01" }), { estado: 400, campo: "desde" });
  assert.deepEqual(error({ desde: "2024-01-01", hasta: "2026-10-01" }), { estado: 400, campo: "desde" });
  assert.deepEqual(error({ desde: "2026-02-30" }), { estado: 400, campo: "desde" });
});

test("criterio 3: muestra el estado del justificativo vigente de cada novedad", async () => {
  const { dias } = await consultarAna();
  const del = (fecha) => dias.find((d) => d.fecha === fecha);
  assert.equal(del("2026-10-01").novedades[0].justificacion, null);
  const aprobada = del("2026-10-02").novedades[0].justificacion;
  assert.equal(aprobada.estado.codigo, "APROBADA");
  assert.equal(aprobada.revision.nombre_revisor, "Sofía Supervisora");
  assert.equal(del("2026-10-03").novedades[0].justificacion.estado.codigo, "PENDIENTE");
});

test("criterio 3: muestra la licencia o permiso que cubre el día con su estado", async () => {
  const { dias } = await consultarAna();
  const licencias = dias.find((d) => d.fecha === "2026-10-05").licencias;
  assert.equal(licencias.length, 1);
  assert.equal(licencias[0].estado.codigo, "APROBADA");
  assert.equal(licencias[0].tipo.nombre, "Licencia médica");
  assert.equal(dias.find((d) => d.fecha === "2026-10-06").licencias.length, 0);
});

test("criterio 4: rechaza la consulta del historial de otro trabajador", async () => {
  await assert.rejects(servicio.consultar(ANA, { id_empleado: LUIS }), { estado: 403 });
  assert.equal(listarMarcajes.mock.callCount(), 0);
  // Pedir el propio id explícitamente sí está permitido.
  await servicio.consultar(ANA, { id_empleado: ANA.toUpperCase() });
});

test("criterio 4: exige una identificación válida de un empleado registrado", async () => {
  await assert.rejects(servicio.consultar(undefined, {}), { estado: 401 });
  await assert.rejects(servicio.consultar("no-es-uuid", {}), { estado: 401 });
  await assert.rejects(servicio.consultar(LUIS, {}), { estado: 403 });
  assert.equal(obtener.mock.callCount(), 1);
  assert.equal(listarMarcajes.mock.callCount(), 0);
});

test("todas las consultas usan solo el id del colaborador identificado", async () => {
  await consultarAna();
  for (const metodo of ["listarMarcajes", "listarNovedades", "listarHoras", "listarLicencias"]) {
    assert.equal(modelo[metodo].mock.calls[0].arguments[0], ANA);
  }
  assert.deepEqual(programacion.listarProgramacion.mock.calls[0].arguments[2], [ANA]);
});

test("si falla el cálculo de horas, muestra el historial con lo ya calculado", async () => {
  calcular.mock.mockImplementation(async () => {
    throw new Error("sin conexión");
  });
  mock.method(console, "error", () => {});
  const { resumen } = await consultarAna();
  assert.equal(resumen.minutos_trabajados, 875);
});
