const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/eventos.model");
const pubsub = require("../src/config/pubsub");
const servicio = require("../src/services/eventos.service");

const DETALLE = {
  id_rol: "rol-1",
  version_publicada: 1,
  publicado_en: "2026-10-18T14:00:00Z",
  sucursal: { id_sucursal: "s", nombre: "Centro" },
  area: { id_departamento: "a", codigo: "PAN", nombre: "Panadería" },
  periodo: { codigo: "SEMANAL" },
  fecha_inicio: "2026-10-19",
  fecha_fin: "2026-10-19",
  dias: ["2026-10-19"],
  empleados: [],
  turnos: [],
  asignaciones: [],
};

const pendiente = (cambios = {}) => ({
  id_evento: "ev-1",
  topico: "produccion-logistica",
  tipo_evento: "ROL_TURNOS_PUBLICADO",
  intentos: 0,
  carga: {
    encabezado: {
      id_mensaje: "ev-1",
      origen: { grupo: "F", modulo: "RRHH" },
      destino: { grupo: "G", modulo: "Producción y Logística" },
      tipo: "ROL_TURNOS_PUBLICADO",
      fecha: "2026-10-18T14:00:00.000Z",
      version_esquema: 1,
    },
    datos: { id_rol: "rol-1" },
  },
  ...cambios,
});

// Cliente de Pub/Sub falso: guarda lo publicado por tópico o falla con el error indicado.
function clienteFalso(error) {
  const publicados = [];
  return {
    publicados,
    topic: (nombre) => ({
      publishMessage: async (mensaje) => {
        if (error) throw error;
        publicados.push({ topico: nombre, ...mensaje });
        return "id-pubsub";
      },
    }),
  };
}

beforeEach(() => {
  mock.restoreAll();
  delete process.env.PUBSUB_PREFIJO_TOPICO;
  process.env.AREAS_PRODUCCION = "PAN";
  process.env.AREAS_REPARTO = "PAN";
});

test("publicar un rol de producción y reparto deja un mensaje por grupo, con el id del evento en el encabezado", async () => {
  const registrar = mock.method(modelo, "registrar", async () => {});
  await servicio.registrarPublicacion({}, DETALLE);
  const filas = registrar.mock.calls.map((c) => c.arguments[1]);
  assert.deepEqual(
    filas.map((f) => [f.topico, f.carga.encabezado.destino.grupo]),
    [
      ["produccion-logistica", "G"],
      ["entregas-despachos", "H"],
    ]
  );
  for (const fila of filas) {
    assert.equal(fila.carga.encabezado.id_mensaje, fila.idEvento);
    assert.deepEqual(fila.carga.encabezado.origen, { grupo: "F", modulo: "RRHH" });
    assert.equal(fila.carga.datos.id_rol, "rol-1");
  }
  assert.notEqual(filas[0].idEvento, filas[1].idEvento);
});

test("sin Pub/Sub configurado no reserva ni envía nada", async () => {
  mock.method(pubsub, "obtenerCliente", () => null);
  const reservar = mock.method(modelo, "reservarPendientes", async () => []);
  assert.equal(await servicio.despachar(), 0);
  assert.equal(reservar.mock.callCount(), 0);
});

test("publica en el tópico del grupo con el encabezado como atributos y marca entregado", async () => {
  const cliente = clienteFalso();
  mock.method(pubsub, "obtenerCliente", () => cliente);
  const reservar = mock.method(modelo, "reservarPendientes", async () => [pendiente()]);
  const entregado = mock.method(modelo, "marcarEntregado", async () => 1);
  process.env.PUBSUB_PREFIJO_TOPICO = "ucb-sis323-sub-";

  assert.equal(await servicio.despachar(), 1);
  assert.deepEqual(reservar.mock.calls[0].arguments[0], ["produccion-logistica", "entregas-despachos"]);
  assert.equal(cliente.publicados.length, 1);
  const [publicado] = cliente.publicados;
  assert.equal(publicado.topico, "ucb-sis323-sub-g");
  assert.deepEqual(publicado.json, pendiente().carga);
  assert.equal(publicado.attributes.origen, "F");
  assert.equal(publicado.attributes.destino, "G");
  assert.deepEqual(entregado.mock.calls[0].arguments, ["ev-1"]);
});

test("un error de red se reintenta más tarde; un tópico inexistente queda fallido", async () => {
  mock.method(console, "error", () => {});
  mock.method(modelo, "reservarPendientes", async () => [pendiente({ intentos: 2 })]);
  const marcarError = mock.method(modelo, "marcarError", async () => {});

  mock.method(pubsub, "obtenerCliente", () => clienteFalso(Object.assign(new Error("UNAVAILABLE"), { code: 14 })));
  await servicio.despachar();
  assert.deepEqual(marcarError.mock.calls[0].arguments, [
    "ev-1",
    { error: "No se pudo conectar con Pub/Sub", esperaMs: 120000, fallido: false },
  ]);

  mock.method(pubsub, "obtenerCliente", () => clienteFalso(Object.assign(new Error("NOT_FOUND"), { code: 5 })));
  await servicio.despachar();
  assert.deepEqual(marcarError.mock.calls[1].arguments[1], {
    error: "El tópico ucb-sis323-sub-g no existe en Pub/Sub",
    esperaMs: 120000,
    fallido: true,
  });
});
