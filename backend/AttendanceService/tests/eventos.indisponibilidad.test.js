// KAN-53 (RF-33): indisponibilidad por ausencias aprobadas hacia Producción y Entregas, con REST, Pub/Sub y reintentos.
const { test, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const modelo = require("../src/models/eventos.model");
const pubsub = require("../src/config/pubsub");
const servicio = require("../src/services/eventos.service");

const SOLICITUD = {
  id_solicitud: "9f1c2d3e-0000-4000-8000-000000000002",
  id_empleado: "4192f252-acf0-4522-a109-e051cad9a50b",
  fecha_inicio: "2026-12-07",
  fecha_fin: "2026-12-11",
  dias_habiles: 5,
};
const datos = (areaCodigo, extra = {}) => ({
  solicitud: SOLICITUD,
  categoria: "VACACIONES",
  empleado: { nombre_completo: "Ana Quispe Mamani" },
  ubicacion: { cargo: "Panadera", area: "Panadería", area_codigo: areaCodigo, sucursal: "Central" },
  aprobadoPor: "Luis Rojas",
  aprobadoEn: "2026-11-02T15:00:00.000Z",
  ...extra,
});

const pendiente = (topico, intentos = 0) => ({
  id_evento: "ev-9",
  topico,
  tipo_evento: "PERSONAL_NO_DISPONIBLE",
  intentos,
  carga: {
    encabezado: {
      id_mensaje: "ev-9",
      origen: { grupo: "F", modulo: "RRHH" },
      destino: { grupo: topico === "produccion-logistica" ? "G" : "H", modulo: "ERP" },
      tipo: "PERSONAL_NO_DISPONIBLE",
      fecha: "2026-11-02T15:00:00.000Z",
      version_esquema: 1,
    },
    datos: { id_solicitud: SOLICITUD.id_solicitud },
  },
});

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
  delete process.env.URL_COMPENSACIONES;
  delete process.env.URL_PRODUCCION_LOGISTICA;
  delete process.env.URL_ENTREGAS_DESPACHOS;
  process.env.AREAS_PRODUCCION = "PROD,PAN";
  process.env.AREAS_REPARTO = "REPARTO";
});

test("un operario de producción deja un evento para Producción y Logística, con encabezado y datos de la ausencia", async () => {
  const registrar = mock.method(modelo, "registrar", async () => {});

  const registrados = await servicio.registrarIndisponibilidad({}, datos("PAN"));

  assert.equal(registrados, 1);
  const fila = registrar.mock.calls[0].arguments[1];
  assert.equal(fila.topico, "produccion-logistica");
  assert.equal(fila.tipoEvento, "PERSONAL_NO_DISPONIBLE");
  assert.equal(fila.idRol, null);
  assert.equal(fila.carga.encabezado.id_mensaje, fila.idEvento);
  assert.equal(fila.carga.encabezado.destino.grupo, "G");
  assert.equal(fila.carga.encabezado.tipo, "PERSONAL_NO_DISPONIBLE");
  assert.deepEqual(fila.carga.datos, {
    id_solicitud: SOLICITUD.id_solicitud,
    categoria: "VACACIONES",
    tipo: "Vacaciones",
    fecha_inicio: "2026-12-07",
    fecha_fin: "2026-12-11",
    dias: 5,
    con_goce_haberes: true,
    empleado: {
      id_empleado: SOLICITUD.id_empleado,
      nombre_completo: "Ana Quispe Mamani",
      cargo: "Panadera",
      area: "Panadería",
      sucursal: "Central",
    },
    aprobado_por: "Luis Rojas",
    aprobado_en: "2026-11-02T15:00:00.000Z",
  });
});

test("un chofer de reparto deja un evento para Entregas y Despachos", async () => {
  const registrar = mock.method(modelo, "registrar", async () => {});

  await servicio.registrarIndisponibilidad({}, datos("REPARTO"));

  assert.equal(registrar.mock.calls[0].arguments[1].topico, "entregas-despachos");
  assert.equal(registrar.mock.calls[0].arguments[1].carga.encabezado.destino.grupo, "H");
});

test("un área que no es de producción ni de reparto no genera eventos", async () => {
  const registrar = mock.method(modelo, "registrar", async () => {});

  assert.equal(await servicio.registrarIndisponibilidad({}, datos("ADM")), 0);
  assert.equal(await servicio.registrarIndisponibilidad({}, datos(null)), 0);
  assert.equal(registrar.mock.callCount(), 0);
});

test("una licencia sin goce informa sus días corridos y que no es con goce de haberes", async () => {
  const registrar = mock.method(modelo, "registrar", async () => {});
  const licencia = { ...SOLICITUD, tipo_nombre: "Académica", dias_solicitados: 3, es_con_goce_haberes: false };

  await servicio.registrarIndisponibilidad({}, datos("PAN", { solicitud: licencia, categoria: "LICENCIA" }));

  const { datos: carga } = registrar.mock.calls[0].arguments[1].carga;
  assert.equal(carga.tipo, "Académica");
  assert.equal(carga.dias, 3);
  assert.equal(carga.con_goce_haberes, false);
  assert.equal(carga.categoria, "LICENCIA");
});

test("criterio 4: con endpoint REST configurado, la indisponibilidad se envía por REST y no por Pub/Sub", async () => {
  process.env.URL_PRODUCCION_LOGISTICA = "http://produccion:4000/ausencias";
  const cliente = clienteFalso();
  mock.method(pubsub, "obtenerCliente", () => cliente);
  mock.method(modelo, "reservarPendientes", async () => [pendiente("produccion-logistica")]);
  const entregado = mock.method(modelo, "marcarEntregado", async () => 1);
  const peticion = mock.method(globalThis, "fetch", async () => ({ ok: true, status: 200 }));

  await servicio.despachar();

  assert.equal(peticion.mock.calls[0].arguments[0], "http://produccion:4000/ausencias");
  assert.equal(peticion.mock.calls[0].arguments[1].headers["X-Topico"], "produccion-logistica");
  assert.equal(cliente.publicados.length, 0);
  assert.deepEqual(entregado.mock.calls[0].arguments, ["ev-9"]);
});

test("el endpoint REST se usa aunque Pub/Sub no esté configurado", async () => {
  process.env.URL_ENTREGAS_DESPACHOS = "http://entregas:4001/ausencias";
  mock.method(pubsub, "obtenerCliente", () => null);
  const reservar = mock.method(modelo, "reservarPendientes", async () => []);

  await servicio.despachar();

  assert.deepEqual(reservar.mock.calls[0].arguments[0], ["entregas-despachos"]);
});

test("fallback: si el endpoint REST falla y hay Pub/Sub, el evento sale por Pub/Sub en el mismo ciclo", async () => {
  process.env.URL_PRODUCCION_LOGISTICA = "http://produccion:4000/ausencias";
  const cliente = clienteFalso();
  mock.method(pubsub, "obtenerCliente", () => cliente);
  mock.method(modelo, "reservarPendientes", async () => [pendiente("produccion-logistica")]);
  const entregado = mock.method(modelo, "marcarEntregado", async () => 1);
  const marcarError = mock.method(modelo, "marcarError", async () => {});
  mock.method(console, "error", () => {});
  mock.method(globalThis, "fetch", async () => ({ ok: false, status: 502 }));

  await servicio.despachar();

  assert.equal(cliente.publicados.length, 1);
  assert.equal(cliente.publicados[0].attributes.tipo, "PERSONAL_NO_DISPONIBLE");
  assert.deepEqual(entregado.mock.calls[0].arguments, ["ev-9"]);
  assert.equal(marcarError.mock.callCount(), 0);
});

test("si fallan el REST y Pub/Sub, el evento queda pendiente con espera creciente (no se pierde)", async () => {
  process.env.URL_PRODUCCION_LOGISTICA = "http://produccion:4000/ausencias";
  mock.method(pubsub, "obtenerCliente", () => clienteFalso(new Error("sin red")));
  mock.method(modelo, "reservarPendientes", async () => [pendiente("produccion-logistica", 1)]);
  const entregado = mock.method(modelo, "marcarEntregado", async () => 1);
  const marcarError = mock.method(modelo, "marcarError", async () => {});
  mock.method(console, "error", () => {});
  mock.method(globalThis, "fetch", async () => {
    throw new Error("ECONNREFUSED");
  });

  await servicio.despachar();

  assert.equal(entregado.mock.callCount(), 0);
  assert.deepEqual(marcarError.mock.calls[0].arguments, [
    "ev-9",
    { error: "No se pudo conectar con Pub/Sub", esperaMs: 60000, fallido: false },
  ]);
});

test("sin Pub/Sub, un fallo del REST se reintenta y tras el máximo de intentos queda fallido", async () => {
  process.env.URL_ENTREGAS_DESPACHOS = "http://entregas:4001/ausencias";
  mock.method(pubsub, "obtenerCliente", () => null);
  const reservar = mock.method(modelo, "reservarPendientes", async () => [pendiente("entregas-despachos", 7)]);
  const marcarError = mock.method(modelo, "marcarError", async () => {});
  mock.method(globalThis, "fetch", async () => ({ ok: false, status: 500 }));

  await servicio.despachar();

  assert.equal(reservar.mock.callCount(), 1);
  assert.equal(marcarError.mock.calls[0].arguments[1].fallido, true);
  assert.equal(marcarError.mock.calls[0].arguments[1].error, "El destino respondió 500");
});

test("reintentar reencola solo los eventos fallidos", async () => {
  const reencolar = mock.method(modelo, "reencolar", async () => {});
  const obtener = mock.method(modelo, "obtener", async () => ({
    id_evento: "5b0c3a0e-1111-4111-8111-000000000001",
    estado_codigo: "FALLIDO",
    estado_nombre: "Fallido",
    topico: "produccion-logistica",
    tipo_evento: "PERSONAL_NO_DISPONIBLE",
    intentos: 8,
  }));

  await servicio.reintentar("5b0c3a0e-1111-4111-8111-000000000001");
  assert.equal(reencolar.mock.callCount(), 1);

  obtener.mock.mockImplementation(async () => ({ id_evento: "x", estado_codigo: "ENTREGADO", estado_nombre: "Entregado" }));
  await assert.rejects(servicio.reintentar("5b0c3a0e-1111-4111-8111-000000000001"), (error) => error.estado === 409);

  obtener.mock.mockImplementation(async () => undefined);
  await assert.rejects(servicio.reintentar("5b0c3a0e-1111-4111-8111-000000000001"), (error) => error.estado === 404);
  await assert.rejects(servicio.reintentar("no-es-uuid"), (error) => error.estado === 404);
});
