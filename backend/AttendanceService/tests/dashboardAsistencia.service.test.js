// RF-73 (KAN-93): dashboard de ausentismo y puntualidad por sucursal.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/dashboardAsistencia.model");
const programacion = require("../src/models/novedades.model");
const empleados = require("../src/services/empleados.service");
const servicio = require("../src/services/dashboardAsistencia.service");

const HOY = "2026-10-19";
const SUCURSAL = "11111111-1111-4111-8111-111111111111";
const OTRA_SUCURSAL = "22222222-2222-4222-8222-222222222222";
const CARGO_SUPERVISOR = "c0000000-0000-4000-8000-000000000001";
const CARGO_CAJERO = "c0000000-0000-4000-8000-000000000002";
const SUPERVISOR = "e0000000-0000-4000-8000-000000000001";
const ANA = "e0000000-0000-4000-8000-000000000002";
const LUIS = "e0000000-0000-4000-8000-000000000003";
const PEDRO = "e0000000-0000-4000-8000-000000000009";

const persona = (id, nombre, extra = {}) => ({
  id_empleado: id,
  nombre_completo: nombre,
  cargo: "Cajero",
  area: "Cajas",
  activo: true,
  id_cargo: CARGO_CAJERO,
  id_sucursal: SUCURSAL,
  sucursal: "Central",
  id_departamento: null,
  ...extra,
});

const PERSONAL = [
  persona(SUPERVISOR, "Sofía Supervisora", { cargo: "Supervisora", id_cargo: CARGO_SUPERVISOR }),
  persona(LUIS, "Luis Rojas"),
  persona(ANA, "Ana Quispe"),
];

// Turno de 8 horas (08:00-16:00) con 1 hora de refrigerio: 420 minutos efectivos por día.
const turno = (id, fecha, descanso = false) => ({
  id_empleado: id,
  fecha,
  descanso,
  hora_inicio: "08:00:00",
  hora_fin: "16:00:00",
  minutos_refrigerio: 60,
});

const RRHH = { idEmpleado: null, rol: "admin" };
const COMO_SUPERVISOR = { idEmpleado: SUPERVISOR, rol: "supervisor" };

let listarPorArea;
let listarProgramacion;

beforeEach(() => {
  mock.restoreAll();
  mock.method(programacion, "momentoActual", async () => ({ ahora: new Date("2026-10-19T14:00:00Z"), hoy: HOY }));
  listarPorArea = mock.method(empleados, "listarPorArea", async () => PERSONAL);
  mock.method(empleados, "listarPersonal", async () => PERSONAL);
  mock.method(empleados, "obtenerSucursal", async (id) => ({ id_sucursal: id, nombre: "Central" }));
  mock.method(empleados, "obtenerArea", async (id) => ({ id_departamento: id, nombre: "Cajas" }));
  mock.method(empleados, "obtenerUbicacion", async (id) =>
    id === SUPERVISOR
      ? { id_empleado: SUPERVISOR, nombre_completo: "Sofía Supervisora", id_cargo: CARGO_SUPERVISOR, id_sucursal: SUCURSAL }
      : null
  );
  mock.method(empleados, "listarCargosSubordinados", async (idCargo) => (idCargo === CARGO_SUPERVISOR ? [CARGO_CAJERO] : []));
  listarProgramacion = mock.method(programacion, "listarProgramacion", async () => [
    // Ana: 10 días programados (420 min c/u = 4200 min programados) y un descanso que no cuenta.
    ...Array.from({ length: 10 }, (_, i) => turno(ANA, `2026-10-${String(i + 1).padStart(2, "0")}`)),
    turno(ANA, "2026-10-11", true),
    // Luis: 4 días programados (1680 min).
    ...["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((f) => turno(LUIS, f)),
  ]);
  mock.method(modelo, "totalizarIndicadores", async () => [
    // Ana: 1 falta (420 min no laborados) y 2 marcajes fuera de tolerancia (35 min en total).
    { id_empleado: ANA, minutos_falta: 420, marcajes_fuera_tolerancia: 2, minutos_atraso: 35 },
  ]);
  mock.method(modelo, "totalizarMarcajesEntrada", async () => [
    { id_empleado: ANA, entradas: 8 },
    { id_empleado: LUIS, entradas: 4 },
  ]);
  mock.method(modelo, "novedadesPorDia", async () => [
    { fecha: "2026-10-05", faltas_injustificadas: 1, faltas_justificadas: 0, atrasos: 1 },
  ]);
});

// ---------- semáforo ----------

test("semaforo: KPI-04 (más bajo es mejor) verde/amarillo/rojo según la meta", () => {
  assert.equal(servicio.semaforo(3, 3, true), "verde");
  assert.equal(servicio.semaforo(2, 3, true), "verde");
  assert.equal(servicio.semaforo(3.2, 3, true), "amarillo"); // < 10 % sobre la meta (3.3)
  assert.equal(servicio.semaforo(3.3, 3, true), "amarillo");
  assert.equal(servicio.semaforo(4, 3, true), "rojo");
  assert.equal(servicio.semaforo(null, 3, true), null);
});

test("semaforo: KPI-05 (más alto es mejor) verde/amarillo/rojo según la meta", () => {
  assert.equal(servicio.semaforo(95, 95, false), "verde");
  assert.equal(servicio.semaforo(98, 95, false), "verde");
  assert.equal(servicio.semaforo(90, 95, false), "amarillo"); // dentro del 10 % bajo la meta (85.5)
  assert.equal(servicio.semaforo(85.5, 95, false), "amarillo");
  assert.equal(servicio.semaforo(80, 95, false), "rojo");
});

// ---------- kpisDe ----------

test("kpisDe: KPI-04 sobre minutos, KPI-05 sobre marcajes y el detalle de minutos de atraso", () => {
  const kpis = servicio.kpisDe({ minutosProgramados: 4200, minutosFalta: 420, entradas: 8, fueraTolerancia: 2, minutosAtraso: 35 });
  assert.deepEqual(kpis.ausentismo, { valor: 10, meta: 3, semaforo: "rojo" });
  assert.deepEqual(kpis.puntualidad, { valor: 75, meta: 95, semaforo: "rojo" });
  assert.deepEqual(kpis.minutos_atraso, { total: 35, promedio_por_atraso: 17.5 });
});

test("kpisDe: sin entradas ni minutos programados, los porcentajes quedan null en vez de 0 %", () => {
  const kpis = servicio.kpisDe({ minutosProgramados: 0, minutosFalta: 0, entradas: 0, fueraTolerancia: 0, minutosAtraso: 0 });
  assert.equal(kpis.ausentismo.valor, null);
  assert.equal(kpis.puntualidad.valor, null);
  assert.equal(kpis.minutos_atraso.promedio_por_atraso, null);
});

// ---------- criterio 1 y 3: generar() ----------

test("calcula KPI-04 y KPI-05 del alcance con su semáforo", async () => {
  const dashboard = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);

  // Total: 4200 + 1680 = 5880 min programados; 420 min de falta; 12 entradas, 2 fuera de tolerancia.
  assert.deepEqual(dashboard.kpis.ausentismo, { valor: 7.1, meta: 3, semaforo: "rojo" });
  assert.deepEqual(dashboard.kpis.puntualidad, { valor: 83.3, meta: 95, semaforo: "rojo" });
});

test("criterio 3: el comparativo agrupa por la sucursal real de cada empleado, no por el filtro", async () => {
  mock.method(empleados, "listarPersonal", async () => [
    ...PERSONAL,
    persona(PEDRO, "Pedro Otra Sucursal", { id_sucursal: OTRA_SUCURSAL, sucursal: "Sucursal Norte" }),
  ]);
  mock.method(modelo, "totalizarIndicadores", async () => [
    { id_empleado: ANA, minutos_falta: 420, marcajes_fuera_tolerancia: 2, minutos_atraso: 35 },
  ]);
  mock.method(modelo, "totalizarMarcajesEntrada", async () => [
    { id_empleado: ANA, entradas: 8 },
    { id_empleado: LUIS, entradas: 4 },
  ]);
  listarProgramacion.mock.mockImplementation(async () => [
    ...Array.from({ length: 10 }, (_, i) => turno(ANA, `2026-10-${String(i + 1).padStart(2, "0")}`)),
    ...["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].map((f) => turno(LUIS, f)),
  ]);

  const dashboard = await servicio.generar({ desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);

  assert.deepEqual(
    dashboard.comparativo_sucursales.map((s) => s.sucursal),
    ["Central", "Sucursal Norte"]
  );
  const norte = dashboard.comparativo_sucursales.find((s) => s.sucursal === "Sucursal Norte");
  assert.equal(norte.ausentismo.valor, null); // Pedro sin turnos ni novedades mockeadas: sin datos, no 0 %.
  assert.equal(dashboard.detalle_diario, null); // RRHH sin filtrar una sucursal: sin detalle diario.
});

test("criterio 4: filtrar por una sucursal trae el detalle diario de faltas y atrasos", async () => {
  const dashboard = await servicio.generar({ id_sucursal: SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, RRHH);

  assert.deepEqual(dashboard.detalle_diario, [
    { fecha: "2026-10-05", faltas_injustificadas: 1, faltas_justificadas: 0, atrasos: 1 },
  ]);
});

test("criterio 2 y 4: el supervisor solo ve su sucursal, con su propio detalle diario", async () => {
  const dashboard = await servicio.generar({ desde: "2026-10-01", hasta: "2026-10-15" }, COMO_SUPERVISOR);

  assert.deepEqual(listarPorArea.mock.calls[0].arguments, [SUCURSAL, null]);
  assert.equal(dashboard.comparativo_sucursales.length, 1);
  assert.equal(dashboard.comparativo_sucursales[0].sucursal, "Central");
  assert.ok(Array.isArray(dashboard.detalle_diario));
  assert.deepEqual(dashboard.alcance, { tipo: "SUPERVISOR", supervisor: { id_empleado: SUPERVISOR, nombre_completo: "Sofía Supervisora" } });
});

test("el supervisor no puede consultar otra sucursal (misma regla que RF-29)", async () => {
  await assert.rejects(
    servicio.generar({ id_sucursal: OTRA_SUCURSAL, desde: "2026-10-01", hasta: "2026-10-15" }, COMO_SUPERVISOR),
    { estado: 403 }
  );
});

test("los demás roles no acceden al dashboard", async () => {
  await assert.rejects(servicio.generar({}, { idEmpleado: ANA, rol: "empleado" }), { estado: 403 });
});
