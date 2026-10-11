const { test } = require("node:test");
const assert = require("node:assert/strict");
const { TOPICO, topicosDelArea, esperaReintento, armarCargaPublicacion } = require("../src/utils/eventos");

const CONFIG = { areasProduccion: "PROD, pan,FRAC", areasReparto: "REPARTO" };

test("producción va a Producción y Logística; reparto, a Entregas y Despachos", () => {
  assert.deepEqual(topicosDelArea("PAN", CONFIG), [TOPICO.PRODUCCION_LOGISTICA]);
  assert.deepEqual(topicosDelArea("frac", CONFIG), [TOPICO.PRODUCCION_LOGISTICA]);
  assert.deepEqual(topicosDelArea("REPARTO", CONFIG), [TOPICO.ENTREGAS_DESPACHOS]);
});

test("las demás áreas no generan eventos, ni sin configuración", () => {
  assert.deepEqual(topicosDelArea("CAJAS", CONFIG), []);
  assert.deepEqual(topicosDelArea(null, CONFIG), []);
  assert.deepEqual(topicosDelArea("PAN", {}), []);
});

test("un área en ambas listas avisa a los dos módulos", () => {
  assert.deepEqual(topicosDelArea("MIX", { areasProduccion: "MIX", areasReparto: "MIX" }), [
    TOPICO.PRODUCCION_LOGISTICA,
    TOPICO.ENTREGAS_DESPACHOS,
  ]);
});

test("reintentos con espera creciente hasta una hora", () => {
  assert.deepEqual([1, 2, 3, 4].map(esperaReintento), [30000, 60000, 120000, 240000]);
  assert.equal(esperaReintento(20), 60 * 60 * 1000);
});

test("la carga trae la disponibilidad por día y el turno de cada colaborador", () => {
  const carga = armarCargaPublicacion({
    id_rol: "rol-1",
    version_publicada: 2,
    publicado_en: "2026-10-10T20:00:00Z",
    sucursal: { id_sucursal: "s", nombre: "Centro" },
    area: { id_departamento: "a", codigo: "PAN", nombre: "Panadería" },
    periodo: { codigo: "SEMANAL" },
    fecha_inicio: "2026-10-12",
    fecha_fin: "2026-10-13",
    dias: ["2026-10-12", "2026-10-13"],
    empleados: [
      { id_empleado: "e1", nombre_completo: "Jorge", cargo: "Panadero", vigente: true },
      { id_empleado: "e2", nombre_completo: "Rosa", cargo: "Panadera", vigente: true },
      { id_empleado: "e3", nombre_completo: "Ex", cargo: null, vigente: false },
    ],
    turnos: [
      { id_turno: "n", nombre: "Noche", hora_inicio: "22:00", hora_fin: "06:00", tipo_codigo: "NOCTURNO" },
      { id_turno: "m", nombre: "Mañana", hora_inicio: "06:00", hora_fin: "14:00", tipo_codigo: "DIURNO" },
    ],
    asignaciones: [
      { id_empleado: "e1", fecha: "2026-10-12", id_turno: "n", descanso: false },
      { id_empleado: "e1", fecha: "2026-10-13", id_turno: null, descanso: true },
      { id_empleado: "e2", fecha: "2026-10-12", id_turno: "m", descanso: false },
      { id_empleado: "e2", fecha: "2026-10-13", id_turno: "m", descanso: false },
      { id_empleado: "e3", fecha: "2026-10-12", id_turno: "m", descanso: false },
    ],
  });
  assert.equal(carga.evento, "ROL_TURNOS_PUBLICADO");
  assert.equal(carga.version, 2);
  assert.deepEqual(carga.disponibilidad, [
    { fecha: "2026-10-12", manana: 1, tarde: 0, noche: 1, descanso: 0 },
    { fecha: "2026-10-13", manana: 1, tarde: 0, noche: 0, descanso: 1 },
  ]);
  assert.deepEqual(carga.personal.map((p) => p.id_empleado), ["e1", "e2"]);
  assert.deepEqual(carga.personal[0].turnos, [
    { fecha: "2026-10-12", descanso: false, turno: { nombre: "Noche", hora_inicio: "22:00", hora_fin: "06:00" } },
    { fecha: "2026-10-13", descanso: true, turno: null },
  ]);
});
