const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  TOPICO,
  DESTINOS,
  topicosDelArea,
  esperaReintento,
  topicoDelGrupo,
  armarMensaje,
  atributosDe,
  errorDePublicacion,
  armarCargaPublicacion,
} = require("../src/utils/eventos");

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

test("cada grupo tiene su tópico", () => {
  assert.equal(topicoDelGrupo("ucb-sis323-sub-", DESTINOS[TOPICO.PRODUCCION_LOGISTICA].grupo), "ucb-sis323-sub-g");
  assert.equal(topicoDelGrupo("ucb-sis323-sub-", DESTINOS[TOPICO.ENTREGAS_DESPACHOS].grupo), "ucb-sis323-sub-h");
});

test("el mensaje lleva un encabezado con origen RRHH y el grupo destino, y los datos aparte", () => {
  const mensaje = armarMensaje({
    idMensaje: "m-1",
    destino: DESTINOS[TOPICO.PRODUCCION_LOGISTICA],
    tipo: "ROL_TURNOS_PUBLICADO",
    fecha: "2026-10-18T14:00:00.000Z",
    datos: { id_rol: "rol-1" },
  });
  assert.deepEqual(mensaje, {
    encabezado: {
      id_mensaje: "m-1",
      origen: { grupo: "F", modulo: "RRHH" },
      destino: { grupo: "G", modulo: "Producción y Logística" },
      tipo: "ROL_TURNOS_PUBLICADO",
      fecha: "2026-10-18T14:00:00.000Z",
      version_esquema: 1,
    },
    datos: { id_rol: "rol-1" },
  });
  assert.deepEqual(atributosDe(mensaje), {
    id_mensaje: "m-1",
    origen: "F",
    origen_modulo: "RRHH",
    destino: "G",
    destino_modulo: "Producción y Logística",
    tipo: "ROL_TURNOS_PUBLICADO",
    version_esquema: "1",
  });
});

test("solo el tópico inexistente o el mensaje inválido se dan por fallidos", () => {
  assert.deepEqual(errorDePublicacion({ code: 5 }, "ucb-sis323-sub-g"), {
    mensaje: "El tópico ucb-sis323-sub-g no existe en Pub/Sub",
    permanente: true,
  });
  assert.equal(errorDePublicacion({ code: 3 }).permanente, true);
  assert.equal(errorDePublicacion({ code: 7 }).permanente, false);
  assert.equal(errorDePublicacion({ code: 14 }).permanente, false);
  assert.equal(errorDePublicacion({ code: "ENOENT" }).mensaje, "No se encontró la llave de la cuenta de servicio");
  assert.equal(errorDePublicacion(new Error("x")).mensaje, "No se pudo conectar con Pub/Sub");
});
