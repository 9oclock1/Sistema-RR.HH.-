// RF-29 (KAN-49): reportes de asistencia por sucursal y área.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/reportes.model");
const programacion = require("../src/models/novedades.model");
const empleados = require("../src/services/empleados.service");
const horasExtra = require("../src/services/horasExtra.service");
const servicio = require("../src/services/reportes.service");
const { aCsv, aPdf } = require("../src/services/reportesExportacion");

const HOY = "2026-10-19";
const SUCURSAL = "11111111-1111-4111-8111-111111111111";
const OTRA_SUCURSAL = "22222222-2222-4222-8222-222222222222";
const AREA = "33333333-3333-4333-8333-333333333333";
const CARGO_SUPERVISOR = "c0000000-0000-4000-8000-000000000001";
const CARGO_CAJERO = "c0000000-0000-4000-8000-000000000002";
const CARGO_OTRO_JEFE = "c0000000-0000-4000-8000-000000000003";
const SUPERVISOR = "e0000000-0000-4000-8000-000000000001";
const ANA = "e0000000-0000-4000-8000-000000000002";
const LUIS = "e0000000-0000-4000-8000-000000000003";
const CARLA = "e0000000-0000-4000-8000-000000000004";

const persona = (id, nombre, extra = {}) => ({
  id_empleado: id,
  nombre_completo: nombre,
  cargo: "Cajero",
  area: "Cajas",
  activo: true,
  id_cargo: CARGO_CAJERO,
  id_sucursal: SUCURSAL,
  sucursal: "Central",
  id_departamento: AREA,
  ...extra,
});

const PERSONAL = [
  persona(SUPERVISOR, "Sofía Supervisora", { cargo: "Supervisora", id_cargo: CARGO_SUPERVISOR }),
  persona(LUIS, "Luis Rojas"),
  persona(ANA, "Ana Quispe"),
  // Depende de otra jefatura: no es personal directo del supervisor.
  persona(CARLA, "Carla Flores", { id_cargo: CARGO_OTRO_JEFE }),
];

const dia = (id, fecha, descanso = false) => ({ id_empleado: id, fecha, descanso });

const RRHH = { idEmpleado: null, rol: "admin" };
const COMO_SUPERVISOR = { idEmpleado: SUPERVISOR, rol: "supervisor" };

let listarPorArea;
let listarProgramacion;

beforeEach(() => {
  mock.restoreAll();
  mock.method(programacion, "momentoActual", async () => ({ ahora: new Date("2026-10-19T14:00:00Z"), hoy: HOY }));
  listarPorArea = mock.method(empleados, "listarPorArea", async () => PERSONAL);
  mock.method(empleados, "listarPersonal", async () => [
    ...PERSONAL,
    persona("e0000000-0000-4000-8000-000000000009", "Pedro Otra Sucursal", { id_sucursal: OTRA_SUCURSAL, id_departamento: null }),
  ]);
  mock.method(empleados, "obtenerSucursal", async (id) => ({ id_sucursal: id, nombre: "Central" }));
  mock.method(empleados, "obtenerArea", async (id) => ({ id_departamento: id, nombre: "Cajas" }));
  mock.method(empleados, "obtenerUbicacion", async (id) =>
    id === SUPERVISOR
      ? { id_empleado: SUPERVISOR, nombre_completo: "Sofía Supervisora", id_cargo: CARGO_SUPERVISOR, id_sucursal: SUCURSAL }
      : null
  );
  mock.method(empleados, "listarCargosSubordinados", async (idCargo) => (idCargo === CARGO_SUPERVISOR ? [CARGO_CAJERO] : []));
  mock.method(horasExtra, "calcular", async () => 0);
  listarProgramacion = mock.method(programacion, "listarProgramacion", async () => [
    // Ana: 10 días programados (y un descanso que no cuenta).
    ...Array.from({ length: 10 }, (_, i) => dia(ANA, `2026-10-${String(i + 1).padStart(2, "0")}`)),
    dia(ANA, "2026-10-11", true),
    // Luis: 4 días programados.
    ...["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((f) => dia(LUIS, f)),
  ]);
  mock.method(modelo, "totalizarNovedades", async () => [
    {
      id_empleado: ANA,
      atrasos: 2,
      minutos_retraso: 35,
      atrasos_justificados: 1,
      faltas_injustificadas: 1,
      faltas_justificadas: 1,
      salidas_anticipadas: 1,
      omisiones_salida: 0,
    },
  ]);
  // Ana marcó entrada 8 de sus 10 días programados; Luis, sus 4.
  mock.method(modelo, "listarDiasConEntrada", async () => [
    ...Array.from({ length: 8 }, (_, i) => ({ id_empleado: ANA, fecha: `2026-10-${String(i + 1).padStart(2, "0")}` })),
    ...["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((fecha) => ({ id_empleado: LUIS, fecha })),
    // Un marcaje en un día sin turno (descanso) no es un día asistido.
    { id_empleado: ANA, fecha: "2026-10-11" },
  ]);
  mock.method(modelo, "totalizarHorasExtra", async () => [{ id_empleado: LUIS, minutos_extra: 150, extra_por_revisar: 1 }]);
});

// ---------- Criterio 1: consolidado agrupado por empleado ----------

test("genera el consolidado por empleado de la sucursal, el área y el rango elegidos", async () => {
  const reporte = await servicio.generar(
    { id_sucursal: SUCURSAL, id_departamento: AREA, desde: "2026-10-01", hasta: "2026-10-15" },
    RRHH
  );

  assert.deepEqual(listarPorArea.mock.calls[0].arguments, [SUCURSAL, AREA]);
  assert.deepEqual(listarProgramacion.mock.calls[0].arguments, ["2026-10-01", "2026-10-15", [SUPERVISOR, LUIS, ANA, CARLA]]);
  assert.deepEqual(
    reporte.empleados.map((f) => f.empleado.nombre_completo),
    ["Ana Quispe", "Carla Flores", "Luis Rojas", "Sofía Supervisora"]
  );
  assert.deepEqual(reporte.filtros, {
    desde: "2026-10-01",
    hasta: "2026-10-15",
    hasta_efectiva: "2026-10-15",
    sucursal: { id_sucursal: SUCURSAL, nombre: "Central" },
    area: { id_departamento: AREA, nombre: "Cajas" },
  });
});

test("solo incluye jornadas cerradas: un rango que llega a hoy se corta en ayer", async () => {
  const reporte = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-31" }, RRHH);

  assert.equal(reporte.filtros.hasta_efectiva, "2026-10-18");
  assert.equal(listarProgramacion.mock.calls[0].arguments[1], "2026-10-18");
  assert.deepEqual(horasExtra.calcular.mock.calls[0].arguments[0], {
    desde: "2026-10-01",
    hasta: "2026-10-18",
    ids: [SUPERVISOR, LUIS, ANA, CARLA],
  });
});

test("RRHH puede consultar toda la empresa o un área de todas las sucursales", async () => {
  const todas = await servicio.generar({ desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);
  assert.equal(todas.empleados.length, 5);
  assert.equal(todas.filtros.sucursal, null);

  const porArea = await servicio.generar({ id_departamento: AREA, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);
  assert.equal(porArea.empleados.length, 4);
});

test("los inactivos aparecen solo si tuvieron turnos o novedades en el periodo", async () => {
  listarPorArea.mock.mockImplementation(async () => [
    persona(ANA, "Ana Quispe", { activo: false }),
    persona(LUIS, "Luis Rojas"),
    persona("e0000000-0000-4000-8000-0000000000aa", "Baja sin actividad", { activo: false }),
  ]);

  const reporte = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);

  assert.deepEqual(reporte.empleados.map((f) => f.empleado.nombre_completo), ["Ana Quispe", "Luis Rojas"]);
});

test("valida el rango de fechas y los identificadores", async () => {
  const errores = async (filtros) => {
    try {
      await servicio.generar(filtros, RRHH);
    } catch (error) {
      assert.equal(error.estado, 400);
      return error.detalles.map((d) => d.mensaje);
    }
    assert.fail("Debió rechazar los filtros");
  };

  assert.deepEqual(await errores({ desde: "2026-13-01", hasta: "2026-10-15" }), ["Use el formato AAAA-MM-DD."]);
  assert.deepEqual(await errores({ desde: "2026-10-15", hasta: "2026-10-01" }), [
    "La fecha inicial no puede ser posterior a la final.",
  ]);
  assert.deepEqual(await errores({ desde: "2025-01-01", hasta: "2026-10-15" }), ["Consulte como máximo 366 días."]);
  assert.deepEqual(await errores({ desde: HOY, hasta: HOY }), [
    "El reporte solo incluye jornadas cerradas: elija una fecha anterior a hoy.",
  ]);
  assert.deepEqual(await errores({ id_sucursal: "abc", desde: "2026-10-01", hasta: "2026-10-02" }), ["Sucursal inválida."]);
});

// ---------- Criterio 3: indicadores clave ----------

test("calcula ausentismo, retrasos, faltas justificadas e injustificadas y horas extra por empleado", async () => {
  const reporte = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);
  const ana = reporte.empleados.find((f) => f.empleado.id_empleado === ANA);
  const luis = reporte.empleados.find((f) => f.empleado.id_empleado === LUIS);

  assert.deepEqual(
    {
      dias_programados: ana.dias_programados,
      dias_asistidos: ana.dias_asistidos,
      faltas_justificadas: ana.faltas_justificadas,
      faltas_injustificadas: ana.faltas_injustificadas,
      porcentaje_ausentismo: ana.porcentaje_ausentismo,
      atrasos: ana.atrasos,
      minutos_retraso: ana.minutos_retraso,
      porcentaje_puntualidad: ana.porcentaje_puntualidad,
      salidas_anticipadas: ana.salidas_anticipadas,
      minutos_extra: ana.minutos_extra,
    },
    {
      dias_programados: 10,
      dias_asistidos: 8,
      faltas_justificadas: 1,
      faltas_injustificadas: 1,
      porcentaje_ausentismo: 20,
      atrasos: 2,
      minutos_retraso: 35,
      porcentaje_puntualidad: 75,
      salidas_anticipadas: 1,
      minutos_extra: 0,
    }
  );
  assert.equal(luis.porcentaje_ausentismo, 0);
  assert.equal(luis.minutos_extra, 150);
  assert.equal(luis.extra_por_revisar, 1);
});

test("sin días programados los porcentajes quedan vacíos en vez de 0 %", () => {
  const fila = servicio.indicadores(0);
  assert.equal(fila.porcentaje_ausentismo, null);
  assert.equal(fila.porcentaje_puntualidad, null);
});

test("los totales recalculan los porcentajes sobre la suma, no promedian los de cada empleado", async () => {
  const { totales } = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);

  assert.equal(totales.empleados, 4);
  assert.equal(totales.dias_programados, 14);
  assert.equal(totales.faltas_justificadas + totales.faltas_injustificadas, 2);
  assert.equal(totales.porcentaje_ausentismo, 14.3);
  assert.equal(totales.minutos_retraso, 35);
  assert.equal(totales.minutos_extra, 150);
  // (12 asistidos - 2 atrasos) / 12
  assert.equal(totales.porcentaje_puntualidad, 83.3);
});

// ---------- Criterio 2: exportación con los indicadores ----------

test("el CSV abre en Excel en español e incluye los indicadores y los totales", async () => {
  const reporte = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);
  const { nombre, contenido } = aCsv(reporte);
  const lineas = contenido.replace(/^﻿/, "").trimEnd().split("\r\n");

  assert.equal(nombre, "reporte-asistencia_2026-10-01_2026-10-15.csv");
  assert.ok(contenido.startsWith("﻿"));
  assert.equal(lineas[1], "Sucursal: Central · Área: Todas");
  assert.equal(lineas[2], "Del 01/10/2026 al 15/10/2026");
  assert.equal(
    lineas[4],
    "Empleado;Cargo;Área;Sucursal;Días programados;Días asistidos;Faltas justificadas;Faltas injustificadas;" +
      "Ausentismo (%);Atrasos;Minutos de retraso;Puntualidad (%);Salidas anticipadas;Horas extra aprobadas"
  );
  assert.equal(lineas[5], "Ana Quispe;Cajero;Cajas;Central;10;8;1;1;20,0 %;2;35;75,0 %;1;0,00");
  assert.match(lineas.at(-1), /^TOTAL \(4 empleados\);;;;14;12;1;1;14,3 %;2;35;83,3 %;1;2,50$/);
});

test("el PDF se genera con el periodo y la tabla del reporte", async () => {
  const reporte = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-31" }, RRHH);
  const { nombre, contenido } = await aPdf(reporte);

  assert.equal(nombre, "reporte-asistencia_2026-10-01_2026-10-18.pdf");
  assert.equal(contenido.subarray(0, 5).toString(), "%PDF-");
  assert.ok(contenido.length > 1000);
});

test("el PDF reparte en varias páginas un reporte largo", async () => {
  const muchos = Array.from({ length: 60 }, (_, i) =>
    persona(`e0000000-0000-4000-8000-${String(i).padStart(12, "0")}`, `Empleado ${String(i).padStart(2, "0")}`)
  );
  listarPorArea.mock.mockImplementation(async () => muchos);
  const reporte = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);

  const { contenido } = await aPdf(reporte);

  const paginas = contenido.toString("latin1").match(/\/Type \/Page\b/g).length;
  assert.ok(paginas >= 2, `páginas: ${paginas}`);
});

// ---------- Criterio 4: el supervisor solo ve su dependencia directa ----------

test("el supervisor ve solo al personal de su sucursal que depende directamente de su cargo", async () => {
  const reporte = await servicio.generar({ desde: "2026-10-01", hasta: "2026-10-15" }, COMO_SUPERVISOR);

  assert.deepEqual(listarPorArea.mock.calls[0].arguments, [SUCURSAL, null]);
  assert.deepEqual(reporte.empleados.map((f) => f.empleado.nombre_completo), ["Ana Quispe", "Luis Rojas"]);
  assert.deepEqual(reporte.alcance, {
    tipo: "SUPERVISOR",
    supervisor: { id_empleado: SUPERVISOR, nombre_completo: "Sofía Supervisora" },
  });
  assert.equal(reporte.filtros.sucursal.id_sucursal, SUCURSAL);
});

test("el supervisor no puede consultar otra sucursal", async () => {
  await assert.rejects(
    servicio.generar({ id_sucursal: OTRA_SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, COMO_SUPERVISOR),
    { estado: 403, message: "Solo puede consultar el personal de su sucursal." }
  );
});

test("el supervisor debe identificarse y existir en el registro de personal", async () => {
  await assert.rejects(servicio.generar({}, { idEmpleado: null, rol: "supervisor" }), { estado: 401 });
  await assert.rejects(servicio.generar({}, { idEmpleado: ANA, rol: "supervisor" }), { estado: 403 });
});

test("un supervisor desvinculado no accede a los reportes", async () => {
  mock.method(empleados, "obtenerUbicacion", async () => ({
    id_empleado: SUPERVISOR,
    nombre_completo: "Sofía Supervisora",
    activo: false,
    id_cargo: CARGO_SUPERVISOR,
    id_sucursal: SUCURSAL,
  }));
  await assert.rejects(servicio.generar({}, COMO_SUPERVISOR), { estado: 403 });
});

test("los días asistidos salen de los marcajes de entrada, no de restar las faltas registradas", async () => {
  mock.method(modelo, "totalizarNovedades", async () => []);
  const reporte = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);
  const ana = reporte.empleados.find((f) => f.empleado.id_empleado === ANA);

  // Sin falta registrada, 2 días sin marcajes igual no cuentan como asistidos.
  assert.equal(ana.dias_programados, 10);
  assert.equal(ana.dias_asistidos, 8);
});

test("los demás roles no acceden a los reportes", async () => {
  await assert.rejects(servicio.generar({}, { idEmpleado: ANA, rol: "empleado" }), { estado: 403 });
  await assert.rejects(servicio.generar({}, { idEmpleado: null, rol: null }), { estado: 403 });
});

test("los filtros del supervisor se limitan a su sucursal y a las áreas de su personal", async () => {
  const alcance = await servicio.alcanceFiltros(COMO_SUPERVISOR);

  assert.deepEqual(alcance, {
    tipo: "SUPERVISOR",
    supervisor: { id_empleado: SUPERVISOR, nombre_completo: "Sofía Supervisora" },
    sucursal_fija: SUCURSAL,
    sucursales: [{ id_sucursal: SUCURSAL, nombre: "Central" }],
    areas: [{ id_departamento: AREA, nombre: "Cajas" }],
    personal_a_cargo: 2,
  });
});

test("el personal a cargo cuenta solo a los activos", async () => {
  listarPorArea.mock.mockImplementation(async () => [...PERSONAL, persona("e0000000-0000-4000-8000-000000000008", "Jorge Baja", { activo: false })]);
  const alcance = await servicio.alcanceFiltros(COMO_SUPERVISOR);
  assert.equal(alcance.personal_a_cargo, 2);
});

test("RRHH recibe todas las sucursales y áreas como filtros", async () => {
  mock.method(empleados, "listarSucursales", async () => [{ id_sucursal: SUCURSAL, nombre: "Central" }]);
  mock.method(empleados, "listarAreas", async () => [{ id_departamento: AREA, nombre: "Cajas" }]);

  const alcance = await servicio.alcanceFiltros({ idEmpleado: null, rol: "gerente" });

  assert.equal(alcance.tipo, "RRHH");
  assert.equal(alcance.sucursal_fija, null);
  assert.equal(alcance.sucursales.length, 1);
  assert.equal(alcance.areas.length, 1);
});
