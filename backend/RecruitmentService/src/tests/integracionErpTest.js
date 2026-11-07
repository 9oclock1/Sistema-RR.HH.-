// KAN-34 (RF-14.7): pruebas de integración con mocks del ERP.
// El ERP se simula con un servidor HTTP real (Contabilidad y módulos operativos) y un cliente Pub/Sub falso;
// la base se simula con el modelo, así se prueba el envío, la clasificación de errores y los reintentos.
const { describe, it, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const { integracion } = require("../config");
const pubsub = require("../config/pubsub");
const modelo = require("../models/integracionModel");
const clienteRest = require("../services/clienteRestErp");
const servicio = require("../services/integracionService");
const {
  MAXIMO_INTENTOS,
  armarMensajesAlta,
  atributosDe,
  clasificarRespuestaRest,
  errorDePublicacion,
  esperaReintento,
} = require("../utils/integracion");

const DESTINOS = {
  CONTABILIDAD: { id_destino: 1, codigo: "CONTABILIDAD", grupo: "D", nombre_modulo: "Contabilidad", canal: "REST" },
  MARKETPLACE_POS: { id_destino: 2, codigo: "MARKETPLACE_POS", grupo: "E", nombre_modulo: "Marketplace / POS", canal: "PUBSUB" },
  INVENTARIOS: { id_destino: 3, codigo: "INVENTARIOS", grupo: "I", nombre_modulo: "Inventarios", canal: "PUBSUB" },
  ENTREGAS: { id_destino: 4, codigo: "ENTREGAS", grupo: "H", nombre_modulo: "Entregas y Despachos", canal: "PUBSUB" },
};
const CARGOS = {
  CAJERO: { codigo: "CAJERO", nombre: "Cajero", codigo_destino: "MARKETPLACE_POS" },
  VENDEDOR: { codigo: "VENDEDOR", nombre: "Vendedor", codigo_destino: "MARKETPLACE_POS" },
  ALMACENERO: { codigo: "ALMACENERO", nombre: "Almacenero", codigo_destino: "INVENTARIOS" },
  CHOFER: { codigo: "CHOFER", nombre: "Chofer", codigo_destino: "ENTREGAS" },
};
const ALTA = {
  id_postulacion: "33333333-3333-4333-8333-000000000001",
  id_empleado_generado: null,
  numero_documento: "1000001",
  nombres: "Ana",
  apellidos: "Pérez",
  correo_electronico: "ana@test.com",
  telefono_contacto: "70000001",
  ciudad: "La Paz",
  id_convocatoria: "11111111-1111-4111-8111-111111111111",
  codigo_convocatoria: "CONV-CAJ-01",
  titulo_puesto: "Cajero",
  id_cargo_referencial: "55555555-5555-4555-8555-555555555555",
  id_sucursal_destino: "66666666-6666-4666-8666-666666666666",
};
const USUARIO = { id: "44444444-4444-4444-8444-444444444444", nombre: "María Pérez" };
const POSTULACION = { id_postulacion: ALTA.id_postulacion, contratado_en: "2026-10-20T15:00:00.000Z" };

const mensajesPara = (cargo) =>
  armarMensajesAlta({ postulacion: POSTULACION, alta: ALTA, cargo: CARGOS[cargo], usuario: USUARIO, destinos: DESTINOS });

// Evento tal como lo devuelve reservarPendientes.
const eventoDe = (mensaje, extra = {}) => ({
  id_evento: `ev-${mensaje.destino.codigo}`,
  id_mensaje: mensaje.idMensaje,
  id_postulacion: ALTA.id_postulacion,
  tipo_evento: mensaje.tipo,
  carga: mensaje.carga,
  intentos: 0,
  codigo_destino: mensaje.destino.codigo,
  canal: mensaje.destino.canal,
  ...extra,
});

// Mock del ERP: cada ruta responde el código configurado y guarda lo que recibió.
const erp = { respuestas: {}, recibidos: [], demoraMs: 0 };
let servidor;
let urlBase;

before(async () => {
  servidor = http.createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (parte) => (cuerpo += parte));
    req.on("end", () => {
      erp.recibidos.push({ ruta: req.url, cabeceras: req.headers, cuerpo: JSON.parse(cuerpo || "{}") });
      setTimeout(() => res.writeHead(erp.respuestas[req.url] ?? 200).end("{}"), erp.demoraMs);
    });
  });
  await new Promise((listo) => servidor.listen(0, "127.0.0.1", listo));
  urlBase = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

// Cliente Pub/Sub falso: guarda lo publicado o falla con el código gRPC indicado.
const crearPubSub = ({ codigoError = null } = {}) => {
  const publicados = [];
  return {
    publicados,
    topic: (nombre) => ({
      publishMessage: async (mensaje) => {
        if (codigoError !== null) throw Object.assign(new Error("pubsub"), { code: codigoError });
        publicados.push({ topico: nombre, ...mensaje });
        return `pubsub-${publicados.length}`;
      },
    }),
  };
};

const configurarUrls = (urls) => {
  for (const codigo of Object.keys(integracion.urlsDestino)) integracion.urlsDestino[codigo] = urls[codigo] ?? null;
};

describe("RF-14.7: mensajes de alta (formato KAN-44)", () => {
  it("genera un mensaje para Contabilidad y otro para el módulo del cargo", () => {
    for (const [cargo, grupo] of [["CAJERO", "E"], ["VENDEDOR", "E"], ["ALMACENERO", "I"], ["CHOFER", "H"]]) {
      const [contabilidad, operativo] = mensajesPara(cargo);
      assert.equal(contabilidad.carga.encabezado.destino.grupo, "D");
      assert.equal(contabilidad.tipo, "ALTA_COLABORADOR_CONTABILIDAD");
      assert.equal(operativo.carga.encabezado.destino.grupo, grupo);
      assert.equal(operativo.tipo, "ALTA_COLABORADOR_OPERATIVO");
    }
  });

  it("arma el encabezado con origen RRHH (F), id_mensaje único y versión de esquema", () => {
    const [contabilidad, operativo] = mensajesPara("CAJERO");
    const { encabezado, datos } = contabilidad.carga;
    assert.deepEqual(encabezado.origen, { grupo: "F", modulo: "RRHH" });
    assert.deepEqual(encabezado.destino, { grupo: "D", modulo: "Contabilidad" });
    assert.equal(encabezado.id_mensaje, contabilidad.idMensaje);
    assert.notEqual(contabilidad.idMensaje, operativo.idMensaje);
    assert.equal(encabezado.version_esquema, 1);
    assert.equal(datos.colaborador.numero_documento, "1000001");
    assert.equal(datos.registro_contable.tipo, "CENTRO_COSTO_BENEFICIARIO");
    assert.equal(datos.contratado_por.nombre, "María Pérez");
    assert.equal(operativo.carga.datos.modulo_asignado, "MARKETPLACE_POS");
  });

  it("repite el encabezado como atributos de Pub/Sub para filtrar por destino", () => {
    const [, operativo] = mensajesPara("CHOFER");
    assert.deepEqual(atributosDe(operativo.carga), {
      id_mensaje: operativo.idMensaje,
      origen: "F",
      origen_modulo: "RRHH",
      destino: "H",
      destino_modulo: "Entregas y Despachos",
      tipo: "ALTA_COLABORADOR_OPERATIVO",
      version_esquema: "1",
    });
  });
});

describe("RF-14.7: clasificación de errores y espera entre reintentos", () => {
  it("toma 2xx y 409 (ya recibido) como entregados", () => {
    assert.deepEqual(clasificarRespuestaRest({ ok: true, estado: 201 }), { entregado: true });
    assert.deepEqual(clasificarRespuestaRest({ ok: false, estado: 409 }), { entregado: true });
  });

  it("reintenta 408, 429, 5xx y fallas de red; un 4xx es permanente", () => {
    for (const estado of [408, 429, 500, 503, undefined]) {
      assert.equal(clasificarRespuestaRest({ ok: false, estado, error: "x" }).permanente, false, `estado ${estado}`);
    }
    for (const estado of [400, 401, 404, 422]) {
      assert.equal(clasificarRespuestaRest({ ok: false, estado, error: "x" }).permanente, true, `estado ${estado}`);
    }
  });

  it("clasifica los errores de Pub/Sub", () => {
    assert.equal(errorDePublicacion({ code: 5 }, "t").permanente, true);
    assert.equal(errorDePublicacion({ code: 3 }, "t").permanente, true);
    assert.equal(errorDePublicacion({ code: 16 }, "t").permanente, false);
    assert.equal(errorDePublicacion({ code: 14 }, "t").permanente, false);
  });

  it("espera 30 s, 1 min, 2 min… sin pasar de 1 h", () => {
    assert.deepEqual([1, 2, 3, 4].map(esperaReintento), [30000, 60000, 120000, 240000]);
    assert.equal(esperaReintento(20), 60 * 60 * 1000);
  });
});

describe("RF-14.7: cliente REST contra el mock del ERP", () => {
  beforeEach(() => {
    erp.respuestas = {};
    erp.recibidos = [];
    erp.demoraMs = 0;
  });

  it("envía el mensaje por POST con id de mensaje, origen y tipo en las cabeceras", async () => {
    const [mensaje] = mensajesPara("CAJERO");
    const resultado = await clienteRest.enviar(eventoDe(mensaje), `${urlBase}/contabilidad`);
    assert.deepEqual(resultado, { ok: true, estado: 200 });
    const [recibido] = erp.recibidos;
    assert.equal(recibido.cabeceras["x-mensaje-id"], mensaje.idMensaje);
    assert.equal(recibido.cabeceras["x-origen"], "F");
    assert.equal(recibido.cabeceras["x-tipo-evento"], "ALTA_COLABORADOR_CONTABILIDAD");
    assert.deepEqual(recibido.cuerpo, mensaje.carga);
  });

  it("informa el código cuando el ERP responde con error", async () => {
    erp.respuestas["/contabilidad"] = 503;
    const resultado = await clienteRest.enviar(eventoDe(mensajesPara("CAJERO")[0]), `${urlBase}/contabilidad`);
    assert.deepEqual(resultado, { ok: false, estado: 503, error: "El destino respondió 503" });
  });

  it("corta la espera si el ERP no responde a tiempo", async () => {
    const original = integracion.tiempoEsperaMs;
    integracion.tiempoEsperaMs = 50;
    erp.demoraMs = 300;
    try {
      const resultado = await clienteRest.enviar(eventoDe(mensajesPara("CAJERO")[0]), `${urlBase}/contabilidad`);
      assert.deepEqual(resultado, { ok: false, error: "El destino no respondió a tiempo" });
    } finally {
      integracion.tiempoEsperaMs = original;
    }
  });

  it("informa cuando no puede conectarse con el ERP", async () => {
    // Un puerto que se acaba de liberar: nadie escucha en él.
    const libre = http.createServer();
    await new Promise((listo) => libre.listen(0, "127.0.0.1", listo));
    const { port } = libre.address();
    await new Promise((listo) => libre.close(listo));
    const resultado = await clienteRest.enviar(eventoDe(mensajesPara("CAJERO")[0]), `http://127.0.0.1:${port}/caido`);
    assert.equal(resultado.ok, false);
    assert.match(resultado.error, /No se pudo conectar con el destino: ECONNREFUSED/);
  });
});

describe("RF-14.7: despachador con el ERP simulado", () => {
  let pendientes;
  let entregados;
  let errores;

  const prepararDespacho = (eventos, clientePubSub = null) => {
    mock.restoreAll();
    pendientes = eventos;
    entregados = [];
    errores = [];
    erp.respuestas = {};
    erp.recibidos = [];
    erp.demoraMs = 0;
    mock.method(pubsub, "obtenerCliente", () => clientePubSub);
    mock.method(modelo, "reservarPendientes", async (codigos) => pendientes.filter((e) => codigos.includes(e.codigo_destino)));
    mock.method(modelo, "marcarEntregado", async (evento) => entregados.push(evento.id_evento));
    mock.method(modelo, "marcarError", async (idEvento, datos) => errores.push({ idEvento, ...datos }));
  };

  it("sin URL ni Pub/Sub no toma eventos (quedan pendientes)", async () => {
    configurarUrls({});
    prepararDespacho([eventoDe(mensajesPara("CAJERO")[0])]);
    assert.equal(await servicio.despachar(), 0);
    assert.equal(modelo.reservarPendientes.mock.callCount(), 0);
  });

  it("entrega por REST y marca el evento como entregado", async () => {
    configurarUrls({ CONTABILIDAD: `${urlBase}/contabilidad`, MARKETPLACE_POS: `${urlBase}/pos` });
    const [contabilidad, operativo] = mensajesPara("CAJERO");
    prepararDespacho([eventoDe(contabilidad), eventoDe(operativo)]);
    assert.equal(await servicio.despachar(), 2);
    assert.deepEqual(entregados.sort(), ["ev-CONTABILIDAD", "ev-MARKETPLACE_POS"]);
    assert.deepEqual(erp.recibidos.map((r) => r.ruta).sort(), ["/contabilidad", "/pos"]);
  });

  it("sin URL publica en el tópico único de RRHH con el destino en los atributos", async () => {
    configurarUrls({});
    const pubsubFalso = crearPubSub();
    const [, operativo] = mensajesPara("ALMACENERO");
    prepararDespacho([eventoDe(operativo)], pubsubFalso);
    await servicio.despachar();
    assert.deepEqual(entregados, ["ev-INVENTARIOS"]);
    assert.equal(pubsubFalso.publicados[0].topico, "ucb-sis323-sub-f");
    assert.equal(pubsubFalso.publicados[0].attributes.destino, "I");
    assert.deepEqual(pubsubFalso.publicados[0].json, operativo.carga);
  });

  it("si el REST de un módulo operativo falla, sale por Pub/Sub en el mismo ciclo", async () => {
    configurarUrls({ MARKETPLACE_POS: `${urlBase}/pos` });
    erp.respuestas["/pos"] = 503;
    const pubsubFalso = crearPubSub();
    const [, operativo] = mensajesPara("CAJERO");
    prepararDespacho([eventoDe(operativo)], pubsubFalso);
    erp.respuestas["/pos"] = 503;
    await servicio.despachar();
    assert.deepEqual(entregados, ["ev-MARKETPLACE_POS"]);
    assert.equal(pubsubFalso.publicados.length, 1);
    assert.equal(errores.length, 0);
  });

  it("Contabilidad (canal REST) no usa Pub/Sub como respaldo: reintenta con espera creciente", async () => {
    configurarUrls({ CONTABILIDAD: `${urlBase}/contabilidad` });
    const pubsubFalso = crearPubSub();
    const [contabilidad] = mensajesPara("CAJERO");
    prepararDespacho([eventoDe(contabilidad, { intentos: 2 })], pubsubFalso);
    erp.respuestas["/contabilidad"] = 503;
    await servicio.despachar();
    assert.equal(pubsubFalso.publicados.length, 0);
    assert.deepEqual(errores, [
      { idEvento: "ev-CONTABILIDAD", error: "El destino respondió 503", esperaMs: esperaReintento(3), fallido: false },
    ]);
  });

  it("un 4xx del ERP deja el alta FALLIDA sin reintentar", async () => {
    configurarUrls({ CONTABILIDAD: `${urlBase}/contabilidad` });
    prepararDespacho([eventoDe(mensajesPara("CAJERO")[0])]);
    erp.respuestas["/contabilidad"] = 400;
    await servicio.despachar();
    assert.equal(errores[0].fallido, true);
  });

  it("el 409 del ERP (mensaje ya recibido) cuenta como entregado", async () => {
    configurarUrls({ CONTABILIDAD: `${urlBase}/contabilidad` });
    prepararDespacho([eventoDe(mensajesPara("CAJERO")[0], { intentos: 1 })]);
    erp.respuestas["/contabilidad"] = 409;
    await servicio.despachar();
    assert.deepEqual(entregados, ["ev-CONTABILIDAD"]);
  });

  it(`al agotar los ${MAXIMO_INTENTOS} intentos el alta queda FALLIDA`, async () => {
    configurarUrls({ CONTABILIDAD: `${urlBase}/contabilidad` });
    prepararDespacho([eventoDe(mensajesPara("CAJERO")[0], { intentos: MAXIMO_INTENTOS - 1 })]);
    erp.respuestas["/contabilidad"] = 503;
    await servicio.despachar();
    assert.equal(errores[0].fallido, true);
  });

  it("un tópico inexistente deja el alta FALLIDA; una caída de Pub/Sub se reintenta", async () => {
    configurarUrls({});
    const [, operativo] = mensajesPara("CHOFER");
    prepararDespacho([eventoDe(operativo)], crearPubSub({ codigoError: 5 }));
    await servicio.despachar();
    assert.equal(errores[0].fallido, true);
    assert.match(errores[0].error, /no existe en Pub\/Sub/);

    prepararDespacho([eventoDe(operativo)], crearPubSub({ codigoError: 14 }));
    await servicio.despachar();
    assert.equal(errores[0].fallido, false);
  });
});

describe("RF-14.7: reintento manual de un alta fallida", () => {
  beforeEach(() => mock.restoreAll());

  it("devuelve 404 si el evento no existe", async () => {
    mock.method(modelo, "obtener", async () => null);
    await assert.rejects(servicio.reintentar("ev-x"), { status: 404 });
  });

  it("solo reencola los eventos fallidos", async () => {
    mock.method(modelo, "obtener", async () => ({ id_evento: "ev-1", estado: "ENTREGADO" }));
    mock.method(modelo, "reencolar", async () => false);
    await assert.rejects(servicio.reintentar("ev-1"), { status: 409 });
  });

  it("vuelve a PENDIENTE un alta fallida", async () => {
    const estados = [{ estado: "FALLIDO" }, { estado: "PENDIENTE" }];
    mock.method(modelo, "obtener", async () => ({ id_evento: "ev-1", ...estados.shift() }));
    mock.method(modelo, "reencolar", async () => true);
    const evento = await servicio.reintentar("ev-1");
    assert.equal(evento.estado, "PENDIENTE");
    assert.equal(modelo.reencolar.mock.callCount(), 1);
  });
});
