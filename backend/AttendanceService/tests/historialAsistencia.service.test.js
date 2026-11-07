const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/historialAsistencia.model");
const novedadesModelo = require("../src/models/novedades.model");
const servicio = require("../src/services/historialAsistencia.service");

const ANA = "e0000000-0000-4000-8000-000000000001";

const novedad = (tipo, minutos, estado = "REGISTRADA") => ({ tipo, nombre: tipo, minutos, estado });

const JORNADAS = [
  { fecha_jornada: "2026-10-18", entrada_en: "2026-10-18T12:12:00Z", salida_en: "2026-10-18T20:05:00Z", minutos_trabajados: 413, minutos_extra: 5, novedades: [novedad("ATRASO", 12)] },
  { fecha_jornada: "2026-10-17", entrada_en: null, salida_en: null, minutos_trabajados: null, minutos_extra: null, novedades: [novedad("INASISTENCIA", 0)] },
  { fecha_jornada: "2026-10-16", entrada_en: "2026-10-16T11:58:00Z", salida_en: "2026-10-16T19:30:00Z", minutos_trabajados: 452, minutos_extra: 0, novedades: [novedad("ATRASO", 3), novedad("SALIDA_ANTICIPADA", 30, "JUSTIFICADA")] },
  { fecha_jornada: "2026-10-14", entrada_en: "2026-10-14T12:00:00Z", salida_en: null, minutos_trabajados: null, minutos_extra: null, novedades: [novedad("OMISION_SALIDA", 0)] },
];

let listar;

beforeEach(() => {
  mock.restoreAll();
  mock.method(novedadesModelo, "momentoActual", async () => ({ ahora: new Date("2026-10-19T15:00:00Z"), hoy: "2026-10-19" }));
  listar = mock.method(modelo, "listarJornadas", async () => JORNADAS);
});

test("sin filtros consulta el último año hasta hoy", async () => {
  const resultado = await servicio.historial(ANA.toUpperCase(), {});

  assert.deepEqual(listar.mock.calls[0].arguments, [ANA, "2025-10-20", "2026-10-19"]);
  assert.equal(resultado.id_empleado, ANA);
  assert.equal(resultado.desde, "2025-10-20");
  assert.equal(resultado.hasta, "2026-10-19");
  assert.equal(resultado.jornadas, JORNADAS);
});

test("respeta el rango pedido", async () => {
  await servicio.historial(ANA, { desde: "2026-09-01", hasta: "2026-09-30" });

  assert.deepEqual(listar.mock.calls[0].arguments, [ANA, "2026-09-01", "2026-09-30"]);
});

test("resume las jornadas trabajadas, el tiempo y cada tipo de novedad", async () => {
  const { resumen } = await servicio.historial(ANA, {});

  assert.deepEqual(resumen, {
    jornadas_trabajadas: 3,
    minutos_trabajados: 865,
    minutos_extra: 5,
    atrasos: 2,
    minutos_atraso: 15,
    inasistencias: 1,
    salidas_anticipadas: 1,
    omisiones_salida: 1,
    novedades_justificadas: 1,
  });
});

test("sin jornadas el resumen queda en cero", async () => {
  listar.mock.mockImplementation(async () => []);

  const { resumen, jornadas } = await servicio.historial(ANA, {});

  assert.deepEqual(jornadas, []);
  assert.ok(Object.values(resumen).every((valor) => valor === 0));
});

for (const [descripcion, idEmpleado, filtros, campo] of [
  ["un id que no es UUID", "abc", {}, "idEmpleado"],
  ["una fecha mal formada", ANA, { desde: "2026-13-01" }, "desde"],
  ["un rango invertido", ANA, { desde: "2026-10-10", hasta: "2026-10-01" }, "desde"],
  ["un rango de más de 366 días", ANA, { desde: "2024-01-01", hasta: "2026-10-01" }, "desde"],
]) {
  test(`rechaza ${descripcion} con 400 sin consultar la base`, async () => {
    await assert.rejects(servicio.historial(idEmpleado, filtros), (error) => {
      assert.equal(error.estado, 400);
      assert.equal(error.detalles[0].campo, campo);
      return true;
    });
    assert.equal(listar.mock.callCount(), 0);
  });
}
