const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const pool = require("../src/config/db");
const modelo = require("../src/models/novedades.model");
const empleados = require("../src/services/empleados.service");
const eventos = require("../src/services/eventos.service");
const horasExtra = require("../src/services/horasExtra.service");
const servicio = require("../src/services/novedades.service");
const { armarCargaConsolidacion, agruparPorJornada, TIPO_NOVEDAD } = require("../src/utils/novedades");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const LUIS = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const SUCURSAL = "11111111-1111-4111-8111-111111111111";
const ROL = "99999999-9999-4999-8999-999999999999";
const HOY = "2026-10-12";
// 17:00 en Bolivia: el turno de 08:00 a 16:00 ya terminó, pero la jornada se cierra recién a las 18:00.
const AHORA = new Date("2026-10-12T21:00:00Z");

const turno = (id, extra = {}) => ({
  id_empleado: id,
  fecha: HOY,
  descanso: false,
  id_turno: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  id_rol: null,
  nombre_turno: "Mañana",
  hora_inicio: "08:00:00",
  hora_fin: "16:00:00",
  minutos_refrigerio: 60,
  minutos_tolerancia: 10,
  ...extra,
});
const entrada = (id, hora) => ({
  id_marcaje: `e-${id}`,
  id_empleado: id,
  tipo_codigo: "ENTRADA",
  fecha_jornada: HOY,
  fecha_hora_marcaje: new Date(`${HOY}T${hora}:00-04:00`),
});

let registrar;

beforeEach(() => {
  mock.restoreAll();
  mock.method(modelo, "momentoActual", async () => ({ ahora: AHORA, hoy: HOY }));
  mock.method(modelo, "listarProgramacion", async () => [turno(ANA, { id_rol: ROL }), turno(LUIS)]);
  mock.method(modelo, "listarMarcajes", async () => [entrada(ANA, "08:20")]);
  mock.method(modelo, "sumarAtrasosDelMes", async () => [{ id_empleado: ANA, minutos: 45, cantidad: 2 }]);
  registrar = mock.method(modelo, "registrar", async (filas) => filas.length);
  mock.method(horasExtra, "calcular", async () => 3);
});

test("contrastar guarda el atraso con la copia del turno y la falta solo de empleados activos", async () => {
  await servicio.contrastar({ desde: HOY, hasta: HOY, activos: new Set([LUIS]), ahora: AHORA });
  const filas = registrar.mock.calls[0].arguments[0];
  assert.equal(filas.length, 2);
  const [atraso, falta] = filas;
  assert.equal(atraso.id_empleado, ANA);
  assert.equal(atraso.id_tipo_novedad, TIPO_NOVEDAD.ATRASO);
  assert.equal(atraso.minutos, 20);
  assert.equal(atraso.id_rol, ROL);
  assert.equal(atraso.id_marcaje, `e-${ANA}`);
  assert.equal(atraso.inicio_programado.toISOString(), "2026-10-12T12:00:00.000Z");
  assert.equal(atraso.fin_programado.toISOString(), "2026-10-12T20:00:00.000Z");
  assert.equal(atraso.minutos_tolerancia, 10);
  assert.equal(falta.id_empleado, LUIS);
  assert.equal(falta.id_tipo_novedad, TIPO_NOVEDAD.INASISTENCIA);
  assert.equal(falta.minutos_penalizacion, 420);
});

test("sin lista de activos no se registran faltas", async () => {
  await servicio.contrastar({ desde: HOY, hasta: HOY, ahora: AHORA });
  assert.deepEqual(
    registrar.mock.calls[0].arguments[0].map((f) => f.id_tipo_novedad),
    [TIPO_NOVEDAD.ATRASO]
  );
});

test("el contraste programado revisa los últimos 7 días y sigue si EmployeeService no responde", async () => {
  mock.method(empleados, "listarIdsActivos", async () => {
    throw new Error("sin conexión");
  });
  mock.method(console, "error", () => {});
  mock.method(pool, "connect", async () => ({ query: async () => ({ rows: [] }), release: () => {} }));
  mock.method(modelo, "reservarPorConsolidar", async () => []);
  const resultado = await servicio.ejecutarContraste();
  assert.deepEqual(modelo.listarProgramacion.mock.calls[0].arguments, ["2026-10-05", HOY, null]);
  assert.deepEqual(
    registrar.mock.calls[0].arguments[0].map((f) => f.id_tipo_novedad),
    [TIPO_NOVEDAD.ATRASO]
  );
  assert.deepEqual(resultado, { nuevas: 1, consolidadas: 0, horas: 3 });
  assert.deepEqual(horasExtra.calcular.mock.calls[0].arguments, [{ desde: "2026-10-05", hasta: HOY }]);
});

test("al marcar se contrasta solo al empleado, de ayer a mañana, sin registrar faltas", async () => {
  mock.method(modelo, "listarPorMarcajes", async () => []);
  await servicio.alMarcar(ANA, [`e-${ANA}`]);
  assert.deepEqual(modelo.listarProgramacion.mock.calls[0].arguments, ["2026-10-11", "2026-10-13", [ANA]]);
  assert.ok(registrar.mock.calls[0].arguments[0].every((f) => f.id_tipo_novedad !== TIPO_NOVEDAD.INASISTENCIA));
  assert.deepEqual(modelo.listarPorMarcajes.mock.calls[0].arguments, [[`e-${ANA}`]]);
});

const novedadGuardada = (id, fecha, tipo, minutos, estado = "REGISTRADA") => ({
  id_novedad: `${id}-${fecha}-${tipo}`,
  id_empleado: id,
  fecha_jornada: fecha,
  nombre_turno: "Mañana",
  inicio_programado: new Date(`${fecha}T12:00:00Z`),
  fin_programado: new Date(`${fecha}T20:00:00Z`),
  tipo_codigo: tipo,
  estado_codigo: estado,
  minutos,
  minutos_penalizacion: tipo === "OMISION_SALIDA" ? 0 : minutos,
});

test("consolidar: un evento por jornada y todas las novedades marcadas", async () => {
  const consultas = [];
  mock.method(pool, "connect", async () => ({ query: async (texto) => consultas.push(texto), release: () => {} }));
  mock.method(modelo, "reservarPorConsolidar", async () => [
    novedadGuardada(ANA, "2026-10-10", "ATRASO", 25),
    novedadGuardada(ANA, "2026-10-10", "SALIDA_ANTICIPADA", 30),
    novedadGuardada(LUIS, "2026-10-10", "INASISTENCIA", 420),
  ]);
  const marcar = mock.method(modelo, "marcarConsolidadas", async () => {});
  const registrarEvento = mock.method(eventos, "registrarConsolidacion", async () => {});

  assert.equal(await servicio.consolidar(), 3);
  assert.equal(registrarEvento.mock.callCount(), 2);
  assert.deepEqual(
    registrarEvento.mock.calls.map((c) => [c.arguments[1].id_empleado, c.arguments[1].minutos_penalizacion]),
    [
      [ANA, 55],
      [LUIS, 420],
    ]
  );
  assert.equal(marcar.mock.calls[0].arguments[1].length, 3);
  assert.deepEqual([consultas[0], consultas.at(-1)], ["BEGIN", "COMMIT"]);
});

test("consolidar sin jornadas cerradas no registra eventos", async () => {
  mock.method(pool, "connect", async () => ({ query: async () => {}, release: () => {} }));
  mock.method(modelo, "reservarPorConsolidar", async () => []);
  const marcar = mock.method(modelo, "marcarConsolidadas", async () => {});
  const registrarEvento = mock.method(eventos, "registrarConsolidacion", async () => {});
  assert.equal(await servicio.consolidar(), 0);
  assert.equal(registrarEvento.mock.callCount(), 0);
  assert.equal(marcar.mock.callCount(), 0);
});

test("la carga para compensaciones no suma las novedades justificadas", () => {
  const carga = armarCargaConsolidacion([
    novedadGuardada(ANA, "2026-10-10", "ATRASO", 25, "JUSTIFICADA"),
    novedadGuardada(ANA, "2026-10-10", "SALIDA_ANTICIPADA", 30),
    novedadGuardada(ANA, "2026-10-10", "OMISION_SALIDA", 0),
  ]);
  assert.equal(carga.evento, "JORNADA_CONSOLIDADA");
  assert.equal(carga.fecha_jornada, "2026-10-10");
  assert.equal(carga.minutos_penalizacion, 30);
  assert.deepEqual(carga.turno, {
    nombre: "Mañana",
    inicio_programado: "2026-10-10T12:00:00.000Z",
    fin_programado: "2026-10-10T20:00:00.000Z",
  });
  assert.deepEqual(
    carga.novedades.map((n) => [n.tipo, n.estado]),
    [
      ["ATRASO", "JUSTIFICADA"],
      ["SALIDA_ANTICIPADA", "REGISTRADA"],
      ["OMISION_SALIDA", "REGISTRADA"],
    ]
  );
});

test("agrupa las novedades por empleado y jornada", () => {
  const grupos = agruparPorJornada([
    novedadGuardada(ANA, "2026-10-09", "ATRASO", 5),
    novedadGuardada(ANA, "2026-10-10", "ATRASO", 5),
    novedadGuardada(ANA, "2026-10-10", "OMISION_SALIDA", 0),
  ]);
  assert.deepEqual(
    grupos.map((g) => g.length),
    [1, 2]
  );
});

test("panel: valida la sucursal, el área y la fecha", async () => {
  const rechaza = async (filtros, campo) => {
    const error = await servicio.panel(filtros).catch((e) => e);
    assert.equal(error.estado, 400);
    assert.ok(error.detalles.some((d) => d.campo === campo), campo);
  };
  await rechaza({}, "id_sucursal");
  await rechaza({ id_sucursal: "abc" }, "id_sucursal");
  await rechaza({ id_sucursal: SUCURSAL, id_departamento: "x" }, "id_departamento");
  await rechaza({ id_sucursal: SUCURSAL, fecha: "2026-10-13" }, "fecha");
  await rechaza({ id_sucursal: SUCURSAL, fecha: "2026-02-30" }, "fecha");
  await rechaza({ id_sucursal: SUCURSAL, fecha: ["2026-10-01", "2026-10-02"] }, "fecha");
});

test("panel: solo personal activo, estados ordenados por urgencia y resumen", async () => {
  mock.method(empleados, "listarPorArea", async () => [
    { id_empleado: ANA, nombre_completo: "Ana Quispe", cargo: "Cajera", area: "Cajas", activo: true },
    { id_empleado: LUIS, nombre_completo: "Luis Rojas", cargo: "Cajero", area: "Cajas", activo: true },
    { id_empleado: "c0000000-0000-4000-8000-000000000000", nombre_completo: "Carla", activo: false },
  ]);
  const panel = await servicio.panel({ id_sucursal: SUCURSAL.toUpperCase() });
  assert.deepEqual(empleados.listarPorArea.mock.calls[0].arguments, [SUCURSAL, null]);
  assert.equal(panel.fecha, HOY);
  assert.equal(panel.es_hoy, true);
  assert.deepEqual(
    panel.colaboradores.map((c) => [c.nombre_completo, c.estado.codigo]),
    [
      ["Luis Rojas", "INASISTENCIA"],
      ["Ana Quispe", "ATRASO"],
    ]
  );
  const ana = panel.colaboradores[1];
  assert.equal(ana.minutos_atraso, 20);
  assert.equal(ana.turno.hora_inicio, "08:00");
  assert.equal(ana.turno.origen, "ROL");
  assert.equal(ana.entrada.id_marcaje, `e-${ANA}`);
  assert.deepEqual(ana.atraso_del_mes, { minutos: 45, cantidad: 2 });
  assert.equal(panel.colaboradores[0].minutos_inasistencia, 420);
  assert.equal(panel.resumen.inasistencias, 1);
  assert.equal(panel.resumen.atrasos, 1);
  assert.equal(panel.resumen.con_turno, 2);
});

test("panel: una sucursal sin personal no consulta turnos", async () => {
  mock.method(empleados, "listarPorArea", async () => []);
  const panel = await servicio.panel({ id_sucursal: SUCURSAL });
  assert.deepEqual(panel.colaboradores, []);
  assert.equal(modelo.listarProgramacion.mock.callCount(), 0);
});
