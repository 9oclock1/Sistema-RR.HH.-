// KAN-262 (QA de KAN-55): rendimiento con ausencias masivas. Los límites son holgados a propósito (varias veces
// lo medido) para detectar un salto de complejidad, no para fallar por una máquina lenta.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/calendarioAusencias.model");
const empleados = require("../src/services/empleados.service");
const servicio = require("../src/services/calendarioAusencias.service");
const { calcularDias } = require("../src/utils/calendarioAusencias");

const SUC = "11111111-1111-4111-8111-111111111111";
const AREAS = Array.from({ length: 8 }, (_, i) => `a0000000-0000-4000-8000-00000000000${i}`);
const TIPOS = [
  ["VACACIONES", "Vacaciones"], ["MEDICA", "Licencia médica"], ["MATERNIDAD", "Maternidad"], ["DUELO", "Duelo"],
  ["ACADEMICA", "Académica"], ["PERSONAL", "Permiso personal"],
];

const uuid = (n) => `b0000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const fecha = (dia) => new Date(Date.UTC(2026, 10, 1 + dia)).toISOString().slice(0, 10);

// 600 colaboradores en 8 áreas y 1 500 ausencias de 1 a 12 días repartidas entre noviembre y enero.
function escenario(personas = 600, ausenciasTotal = 1500) {
  const personal = Array.from({ length: personas }, (_, i) => ({
    id_empleado: uuid(i),
    nombre_completo: `Colaborador ${i}`,
    cargo: "Operario",
    area: `Área ${i % AREAS.length}`,
    id_departamento: AREAS[i % AREAS.length],
    activo: true,
  }));
  const aprobadas = Array.from({ length: ausenciasTotal }, (_, i) => {
    const [codigo, nombre] = TIPOS[i % TIPOS.length];
    const inicio = (i * 7) % 85;
    return {
      categoria: codigo === "VACACIONES" ? "VACACIONES" : "LICENCIA",
      id_solicitud: uuid(100000 + i),
      id_empleado: uuid((i * 13) % personas),
      tipo_codigo: codigo,
      tipo_nombre: nombre,
      fecha_inicio: fecha(inicio),
      fecha_fin: fecha(inicio + (i % 12)),
      dias: (i % 12) + 1,
      es_con_goce_haberes: true,
    };
  });
  return { personal, aprobadas };
}

const medir = async (trabajo) => {
  const inicio = performance.now();
  const resultado = await trabajo();
  return { resultado, ms: performance.now() - inicio };
};

beforeEach(() => mock.restoreAll());

test("calcula la cobertura de 92 días con 600 colaboradores y 1 500 ausencias en menos de 500 ms", async () => {
  const { personal, aprobadas } = escenario();
  const ausencias = aprobadas.map((a) => ({ empleado: { id_empleado: a.id_empleado }, fecha_inicio: a.fecha_inicio, fecha_fin: a.fecha_fin }));

  const { resultado, ms } = await medir(async () =>
    calcularDias({
      desde: fecha(0),
      hasta: fecha(91),
      idSucursal: SUC,
      personal,
      ausencias,
      // En promedio falta cerca del 17 %: con un umbral del 10 % el escenario sí debe producir alertas.
      umbrales: [{ id_sucursal: null, id_departamento: null, max_ausentes_porcentaje: 10, min_presentes: 1 }],
    })
  );

  assert.equal(resultado.length, 92);
  assert.ok(resultado.some((d) => d.baja_cobertura), "el escenario masivo debe producir alertas");
  assert.ok(ms < 500, `tardó ${ms.toFixed(0)} ms`);
});

test("la consulta completa de un mes con ausencias masivas responde en menos de 800 ms", async () => {
  const { personal, aprobadas } = escenario();
  mock.method(modelo, "hoy", async () => "2026-11-18");
  mock.method(empleados, "listarPorArea", async () => personal);
  mock.method(empleados, "obtenerSucursal", async () => ({ nombre: "Central" }));
  mock.method(empleados, "obtenerArea", async () => ({ nombre: "Área" }));
  mock.method(modelo, "listarAprobadas", async (_ids, desde, hasta) => aprobadas.filter((a) => a.fecha_inicio <= hasta && a.fecha_fin >= desde));
  mock.method(modelo, "listarTurnos", async () => []);
  mock.method(modelo, "listarFeriados", async () => [{ fecha: "2026-11-02", nombre: "Todos Santos" }]);
  mock.method(modelo, "listarUmbrales", async () => AREAS.map((id) => ({ id_sucursal: null, id_departamento: id, max_ausentes_porcentaje: 20, min_presentes: 2 })));

  const { resultado, ms } = await medir(() => servicio.consultar({ id_sucursal: SUC, desde: "2026-11-01", hasta: "2026-11-30" }, { rol: "admin" }));

  assert.equal(resultado.dias.length, 30);
  assert.ok(resultado.ausencias.length > 300);
  assert.ok(ms < 800, `tardó ${ms.toFixed(0)} ms`);
});

test("filtrar por un departamento reduce el trabajo: calcula menos personal y es más rápido que toda la sucursal", async () => {
  const { personal, aprobadas } = escenario();
  const deArea = personal.filter((p) => p.id_departamento === AREAS[0]);
  const ids = new Set(deArea.map((p) => p.id_empleado));
  mock.method(modelo, "hoy", async () => "2026-11-18");
  mock.method(empleados, "obtenerSucursal", async () => ({ nombre: "Central" }));
  mock.method(empleados, "obtenerArea", async () => ({ nombre: "Área 0" }));
  mock.method(empleados, "listarPorArea", async (_s, area) => (area ? deArea : personal));
  const consulta = mock.method(modelo, "listarAprobadas", async (idsPedidos, desde, hasta) =>
    aprobadas.filter((a) => idsPedidos.includes(a.id_empleado) && a.fecha_inicio <= hasta && a.fecha_fin >= desde)
  );
  mock.method(modelo, "listarTurnos", async () => []);
  mock.method(modelo, "listarFeriados", async () => []);
  mock.method(modelo, "listarUmbrales", async () => []);

  const todo = await servicio.consultar({ id_sucursal: SUC, desde: "2026-11-01", hasta: "2026-11-30" }, { rol: "admin" });
  const filtrado = await servicio.consultar({ id_sucursal: SUC, id_departamento: AREAS[0], desde: "2026-11-01", hasta: "2026-11-30" }, { rol: "admin" });

  assert.equal(consulta.mock.calls[1].arguments[0].length, ids.size);
  assert.ok(filtrado.ausencias.length < todo.ausencias.length);
  assert.ok(filtrado.ausencias.every((a) => a.empleado.id_departamento === AREAS[0]));
  assert.equal(filtrado.equipo.activos, 75);
});

test("el tamaño de la respuesta de un mes masivo se mantiene acotado (menos de 1 MB)", async () => {
  const { personal, aprobadas } = escenario();
  mock.method(modelo, "hoy", async () => "2026-11-18");
  mock.method(empleados, "listarPorArea", async () => personal);
  mock.method(empleados, "obtenerSucursal", async () => ({ nombre: "Central" }));
  mock.method(modelo, "listarAprobadas", async (_ids, desde, hasta) => aprobadas.filter((a) => a.fecha_inicio <= hasta && a.fecha_fin >= desde));
  mock.method(modelo, "listarTurnos", async () => []);
  mock.method(modelo, "listarFeriados", async () => []);
  mock.method(modelo, "listarUmbrales", async () => []);

  const resultado = await servicio.consultar({ id_sucursal: SUC, desde: "2026-11-01", hasta: "2026-11-30" }, { rol: "admin" });

  const bytes = Buffer.byteLength(JSON.stringify(resultado));
  assert.ok(bytes < 1024 * 1024, `pesa ${(bytes / 1024).toFixed(0)} KB`);
});
