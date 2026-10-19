const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/vacaciones.model");
const empleados = require("../src/services/empleados.service");
const servicio = require("../src/services/vacaciones.service");

const ANA = "4192f252-acf0-4522-a109-e051cad9a50b";
const SIN_FECHA = "cb7995a6-4b23-4738-ab8b-37d0b203d73b";
const AHORA = new Date("2026-10-18T15:00:00Z");

beforeEach(() => {
  mock.restoreAll();
  mock.method(empleados, "obtener", async (id) => {
    if (id === ANA) return { nombres: "Ana", activo: true, fecha_ingreso: "2023-01-10" };
    if (id === SIN_FECHA) return { nombres: "Luis", activo: true };
    return null;
  });
  mock.method(modelo, "listarMovimientos", async () => [
    { id_movimiento: "m1", id_estado_movimiento: 2, estado_codigo: "GOZADO", dias: 10, fecha_inicio: "2026-02-02", fecha_fin: "2026-02-13" },
    { id_movimiento: "m2", id_estado_movimiento: 1, estado_codigo: "EN_PROCESO", dias: 5, fecha_inicio: "2026-12-01", fecha_fin: "2026-12-07" },
  ]);
});

test("consulta el saldo con períodos, consumo y fecha de Bolivia", async () => {
  const resultado = await servicio.consultarSaldo(ANA, AHORA);
  assert.equal(resultado.fecha_consulta, "2026-10-18");
  assert.deepEqual(resultado.saldo, { acumulados: 45, gozados: 10, en_proceso: 5, disponibles: 30 });
  assert.equal(resultado.periodos.length, 3);
  assert.deepEqual(resultado.movimientos.map((m) => m.estado_codigo), ["GOZADO", "EN_PROCESO"]);
  assert.equal("id_estado_movimiento" in resultado.movimientos[0], false);
});

test("criterio 3: el saldo refleja de inmediato un cambio en los movimientos", async () => {
  assert.equal((await servicio.consultarSaldo(ANA, AHORA)).saldo.disponibles, 30);
  mock.method(modelo, "listarMovimientos", async () => [
    { id_movimiento: "m2", id_estado_movimiento: 2, estado_codigo: "GOZADO", dias: 5, fecha_inicio: "2026-12-01", fecha_fin: "2026-12-07" },
  ]);
  assert.deepEqual((await servicio.consultarSaldo(ANA, AHORA)).saldo, { acumulados: 45, gozados: 5, en_proceso: 0, disponibles: 40 });
});

test("empleado inexistente o con identificador inválido: 404", async () => {
  for (const id of ["00000000-0000-4000-8000-000000000000", "no-es-uuid"]) {
    await assert.rejects(servicio.consultarSaldo(id, AHORA), (error) => error.estado === 404);
  }
});

test("sin fecha de ingreso o con formato inesperado en EmployeeService: 502", async () => {
  await assert.rejects(servicio.consultarSaldo(SIN_FECHA, AHORA), (error) => error.estado === 502);
  mock.method(empleados, "obtener", async () => ({ activo: true, fecha_ingreso: "2023-01-10T00:00:00.000Z" }));
  await assert.rejects(servicio.consultarSaldo(ANA, AHORA), (error) => error.estado === 502);
});

test("consulta propia de un empleado no registrado: 403 (identidad rechazada); la de RRHH sigue siendo 404", async () => {
  const inexistente = "00000000-0000-4000-8000-000000000000";
  await assert.rejects(servicio.consultarMiSaldo(inexistente, AHORA), (error) => error.estado === 403);
  await assert.rejects(servicio.consultarMiSaldo("no-es-uuid", AHORA), (error) => error.estado === 403);
  await assert.rejects(servicio.consultarSaldo(inexistente, AHORA), (error) => error.estado === 404);
  assert.equal((await servicio.consultarMiSaldo(ANA, AHORA)).id_empleado, ANA);
});
