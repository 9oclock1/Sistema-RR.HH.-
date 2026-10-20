// KAN-34 (RF-14.8): verificación del despacho asíncrono del alta y su consumo simulado por los sistemas operativos.
// El despachador real corre con su propio temporizador sobre una bandeja de salida en memoria (mismas reglas que
// EVENTOS_SALIENTES, con el reloj acelerado). Contabilidad se simula con un servidor HTTP que procesa cada mensaje
// una sola vez; Marketplace/POS, Inventarios y Entregas, con suscripciones a un Pub/Sub falso filtradas por destino.
const { describe, it, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { randomUUID } = require("node:crypto");

const { integracion } = require("../config");
const pubsub = require("../config/pubsub");
const modelo = require("../models/integracionModel");
const servicio = require("../services/integracionService");
const { ESTADO_EVENTO } = require("../utils/integracion");

// 30 s de espera entre reintentos pasan a ser 30 ms.
const ESCALA_RELOJ = 1 / 1000;
const ESTADOS = { [ESTADO_EVENTO.PENDIENTE]: "PENDIENTE", [ESTADO_EVENTO.ENTREGADO]: "ENTREGADO", [ESTADO_EVENTO.FALLIDO]: "FALLIDO" };

const DESTINOS = {
  CONTABILIDAD: { id_destino: 1, codigo: "CONTABILIDAD", grupo: "D", nombre_modulo: "Contabilidad", canal: "REST" },
  MARKETPLACE_POS: { id_destino: 2, codigo: "MARKETPLACE_POS", grupo: "E", nombre_modulo: "Marketplace / POS", canal: "PUBSUB" },
  INVENTARIOS: { id_destino: 3, codigo: "INVENTARIOS", grupo: "I", nombre_modulo: "Inventarios", canal: "PUBSUB" },
  ENTREGAS: { id_destino: 4, codigo: "ENTREGAS", grupo: "H", nombre_modulo: "Entregas y Despachos", canal: "PUBSUB" },
};
const CARGOS = {
  CAJERO: { codigo: "CAJERO", nombre: "Cajero", codigo_destino: "MARKETPLACE_POS" },
  ALMACENERO: { codigo: "ALMACENERO", nombre: "Almacenero", codigo_destino: "INVENTARIOS" },
  CHOFER: { codigo: "CHOFER", nombre: "Chofer", codigo_destino: "ENTREGAS" },
};
const USUARIO = { id: "44444444-4444-4444-8444-444444444444", nombre: "María Pérez" };

// ── Bandeja de salida en memoria (EVENTOS_SALIENTES + flags de POSTULACIONES) ──
const bandeja = { eventos: [], flags: new Map(), esperas: [] };
const destinoPorId = (id) => Object.values(DESTINOS).find((d) => d.id_destino === id);

function instalarBandeja() {
  mock.method(modelo, "listarDestinos", async () => DESTINOS);
  mock.method(modelo, "obtenerDatosAlta", async (cliente, idPostulacion) => ({
    id_postulacion: idPostulacion,
    id_empleado_generado: null,
    numero_documento: idPostulacion.slice(0, 7),
    nombres: "Colaborador",
    apellidos: idPostulacion.slice(0, 4),
    correo_electronico: `${idPostulacion.slice(0, 6)}@test.com`,
    telefono_contacto: "70000000",
    ciudad: "La Paz",
    id_convocatoria: "11111111-1111-4111-8111-111111111111",
    codigo_convocatoria: "CONV-QA",
    titulo_puesto: "Personal operativo",
    id_cargo_referencial: "55555555-5555-4555-8555-555555555555",
    id_sucursal_destino: "66666666-6666-4666-8666-666666666666",
  }));
  mock.method(modelo, "registrar", async (cliente, { idMensaje, idPostulacion, idDestino, tipoEvento, carga }) => {
    const repetido = bandeja.eventos.some(
      (e) => e.id_postulacion === idPostulacion && e.id_destino === idDestino && e.tipo_evento === tipoEvento,
    );
    if (repetido) return null;
    const evento = {
      id_evento: randomUUID(),
      id_mensaje: idMensaje,
      id_postulacion: idPostulacion,
      id_destino: idDestino,
      tipo_evento: tipoEvento,
      carga,
      id_estado_evento: ESTADO_EVENTO.PENDIENTE,
      intentos: 0,
      ultimo_error: null,
      proximo_intento_en: Date.now(),
    };
    bandeja.eventos.push(evento);
    return { id_evento: evento.id_evento, id_mensaje: idMensaje, id_destino: idDestino, tipo_evento: tipoEvento };
  });
  mock.method(modelo, "reservarPendientes", async (codigos, limite, segundosReserva) => {
    const ahora = Date.now();
    const reservados = bandeja.eventos
      .filter(
        (e) =>
          e.id_estado_evento === ESTADO_EVENTO.PENDIENTE &&
          e.proximo_intento_en <= ahora &&
          codigos.includes(destinoPorId(e.id_destino).codigo),
      )
      .slice(0, limite);
    for (const e of reservados) e.proximo_intento_en = ahora + segundosReserva * 1000 * ESCALA_RELOJ;
    return reservados.map((e) => ({
      ...e,
      codigo_destino: destinoPorId(e.id_destino).codigo,
      canal: destinoPorId(e.id_destino).canal,
    }));
  });
  mock.method(modelo, "marcarEntregado", async (evento) => {
    const fila = bandeja.eventos.find((e) => e.id_evento === evento.id_evento);
    if (fila.id_estado_evento === ESTADO_EVENTO.ENTREGADO) return;
    Object.assign(fila, { id_estado_evento: ESTADO_EVENTO.ENTREGADO, intentos: fila.intentos + 1, ultimo_error: null });
    const flags = bandeja.flags.get(fila.id_postulacion) ?? { contabilidad: false, operativa: false };
    flags[evento.codigo_destino === "CONTABILIDAD" ? "contabilidad" : "operativa"] = true;
    bandeja.flags.set(fila.id_postulacion, flags);
  });
  mock.method(modelo, "marcarError", async (idEvento, { error, esperaMs, fallido }) => {
    const fila = bandeja.eventos.find((e) => e.id_evento === idEvento);
    bandeja.esperas.push({ idEvento, esperaMs });
    Object.assign(fila, {
      intentos: fila.intentos + 1,
      ultimo_error: error,
      proximo_intento_en: Date.now() + esperaMs * ESCALA_RELOJ,
      id_estado_evento: fallido ? ESTADO_EVENTO.FALLIDO : fila.id_estado_evento,
    });
  });
  mock.method(modelo, "obtener", async (idEvento) => {
    const fila = bandeja.eventos.find((e) => e.id_evento === idEvento);
    return fila ? { ...fila, estado: ESTADOS[fila.id_estado_evento] } : null;
  });
  mock.method(modelo, "reencolar", async (idEvento) => {
    const fila = bandeja.eventos.find((e) => e.id_evento === idEvento && e.id_estado_evento === ESTADO_EVENTO.FALLIDO);
    if (!fila) return false;
    Object.assign(fila, { id_estado_evento: ESTADO_EVENTO.PENDIENTE, intentos: 0, ultimo_error: null, proximo_intento_en: Date.now() });
    return true;
  });
}

// ── Contabilidad simulada (REST): procesa cada id_mensaje una sola vez; un duplicado recibe 409 ──
const contabilidad = { procesados: new Map(), solicitudes: 0, fallarSiguientes: 0, perderRespuestas: 0, rechazarSiguientes: 0 };
let servidorContabilidad;

function consumirEnContabilidad(mensaje) {
  const { encabezado, datos } = mensaje;
  assert.equal(encabezado.destino.grupo, "D");
  assert.equal(encabezado.tipo, "ALTA_COLABORADOR_CONTABILIDAD");
  assert.equal(datos.registro_contable.tipo, "CENTRO_COSTO_BENEFICIARIO");
  contabilidad.procesados.set(encabezado.id_mensaje, datos);
}

// ── Pub/Sub simulado: un solo tópico; cada sistema operativo se suscribe filtrando por su letra de destino ──
const broker = { caido: false, publicaciones: [], suscripciones: [] };
const suscribir = (nombre, grupo) => {
  const sistema = { nombre, grupo, recibidos: new Map() };
  broker.suscripciones.push(sistema);
  return sistema;
};
const pos = suscribir("Marketplace / POS", "E");
const inventarios = suscribir("Inventarios", "I");
const entregas = suscribir("Entregas y Despachos", "H");

const clientePubSub = {
  topic: (topico) => ({
    publishMessage: async ({ json, attributes }) => {
      if (broker.caido) throw Object.assign(new Error("UNAVAILABLE"), { code: 14 });
      broker.publicaciones.push({ topico, attributes });
      // La entrega a los suscriptores es asíncrona, como en Pub/Sub.
      setImmediate(() => {
        for (const sistema of broker.suscripciones.filter((s) => s.grupo === attributes.destino)) {
          sistema.recibidos.set(json.encabezado.id_mensaje, json);
        }
      });
      return `pubsub-${broker.publicaciones.length}`;
    },
  }),
};

// ── Utilidades ──
async function esperarHasta(condicion, { tiempoMaximoMs = 3000, descripcion = "la condición" } = {}) {
  const limite = Date.now() + tiempoMaximoMs;
  while (Date.now() < limite) {
    if (await condicion()) return;
    await new Promise((listo) => setTimeout(listo, 10));
  }
  assert.fail(`No se cumplió ${descripcion} en ${tiempoMaximoMs} ms`);
}

const contratar = (cargo) => {
  const postulacion = { id_postulacion: randomUUID(), contratado_en: new Date().toISOString() };
  return servicio
    .registrarAltaContratacion(null, { postulacion, cargo: CARGOS[cargo], usuario: USUARIO })
    .then((eventos) => ({ postulacion, eventos }));
};
const eventosDe = (idPostulacion) => bandeja.eventos.filter((e) => e.id_postulacion === idPostulacion);
const estadoDe = (idPostulacion, codigoDestino) =>
  ESTADOS[eventosDe(idPostulacion).find((e) => destinoPorId(e.id_destino).codigo === codigoDestino)?.id_estado_evento];
const todoEntregado = (idPostulacion) =>
  eventosDe(idPostulacion).length === 2 &&
  eventosDe(idPostulacion).every((e) => e.id_estado_evento === ESTADO_EVENTO.ENTREGADO);

before(async () => {
  servidorContabilidad = http.createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (parte) => (cuerpo += parte));
    req.on("end", () => {
      contabilidad.solicitudes += 1;
      const mensaje = JSON.parse(cuerpo);
      if (contabilidad.fallarSiguientes > 0) {
        contabilidad.fallarSiguientes -= 1;
        return res.writeHead(503).end();
      }
      if (contabilidad.rechazarSiguientes > 0) {
        contabilidad.rechazarSiguientes -= 1;
        return res.writeHead(422).end();
      }
      if (contabilidad.procesados.has(mensaje.encabezado.id_mensaje)) return res.writeHead(409).end();
      consumirEnContabilidad(mensaje);
      // Lo procesó, pero la respuesta "se pierde": RRHH no se entera y reintentará.
      if (contabilidad.perderRespuestas > 0) {
        contabilidad.perderRespuestas -= 1;
        return res.writeHead(503).end();
      }
      res.writeHead(201).end("{}");
    });
  });
  await new Promise((listo) => servidorContabilidad.listen(0, "127.0.0.1", listo));

  instalarBandeja();
  mock.method(pubsub, "obtenerCliente", () => clientePubSub);
  for (const codigo of Object.keys(integracion.urlsDestino)) integracion.urlsDestino[codigo] = null;
  integracion.urlsDestino.CONTABILIDAD = `http://127.0.0.1:${servidorContabilidad.address().port}/altas`;
  integracion.intervaloMs = 20;
  // El despachador real: un temporizador que toma los pendientes cada intervaloMs.
  servicio.iniciarDespachador();
});

after(() => {
  servidorContabilidad.close();
  mock.restoreAll();
});

beforeEach(() => {
  Object.assign(contabilidad, { fallarSiguientes: 0, perderRespuestas: 0, rechazarSiguientes: 0 });
  broker.caido = false;
  bandeja.esperas = [];
});

describe("RF-14.8: despacho asíncrono del alta del colaborador", () => {
  it("la contratación solo deja los eventos pendientes; el despachador los entrega después", async () => {
    contabilidad.fallarSiguientes = 1000; // Contabilidad caída al contratar: la contratación no se bloquea.
    const { postulacion, eventos } = await contratar("CAJERO");
    assert.equal(eventos.length, 2);
    assert.deepEqual(
      eventosDe(postulacion.id_postulacion).map((e) => ESTADOS[e.id_estado_evento]),
      ["PENDIENTE", "PENDIENTE"],
    );

    contabilidad.fallarSiguientes = 0;
    await esperarHasta(() => todoEntregado(postulacion.id_postulacion), { descripcion: "el alta en ambos módulos" });
    assert.deepEqual(bandeja.flags.get(postulacion.id_postulacion), { contabilidad: true, operativa: true });
  });

  it("volver a registrar el alta de la misma contratación no duplica los eventos", async () => {
    const { postulacion } = await contratar("CAJERO");
    const repetidos = await servicio.registrarAltaContratacion(null, {
      postulacion,
      cargo: CARGOS.CAJERO,
      usuario: USUARIO,
    });
    assert.deepEqual(repetidos, []);
    assert.equal(eventosDe(postulacion.id_postulacion).length, 2);
  });
});

describe("RF-14.8: consumo simulado por Contabilidad y los sistemas operativos", () => {
  it("Contabilidad registra al colaborador como centro de costo y beneficiario", async () => {
    const { postulacion } = await contratar("ALMACENERO");
    await esperarHasta(() => todoEntregado(postulacion.id_postulacion), { descripcion: "el alta del almacenero" });
    const [mensaje] = eventosDe(postulacion.id_postulacion).filter((e) => e.id_destino === 1);
    const registrado = contabilidad.procesados.get(mensaje.id_mensaje);
    assert.equal(registrado.id_postulacion, postulacion.id_postulacion);
    assert.equal(registrado.cargo.codigo, "ALMACENERO");
    assert.equal(registrado.id_sucursal, "66666666-6666-4666-8666-666666666666");
  });

  it("cada cargo llega solo al sistema operativo que le corresponde", async () => {
    const contratos = await Promise.all(["CAJERO", "ALMACENERO", "CHOFER"].map(contratar));
    for (const { postulacion } of contratos) {
      await esperarHasta(() => todoEntregado(postulacion.id_postulacion), { descripcion: "las tres altas" });
    }
    // Pub/Sub entrega a los suscriptores después de confirmar la publicación.
    await esperarHasta(() =>
      contratos.every(({ postulacion }) =>
        [pos, inventarios, entregas].some((s) =>
          [...s.recibidos.values()].some((m) => m.datos.id_postulacion === postulacion.id_postulacion),
        ),
      ),
    );

    const recibioA = (sistema, cargo) =>
      [...sistema.recibidos.values()].filter(
        (m) => m.datos.cargo.codigo === cargo && contratos.some((c) => c.postulacion.id_postulacion === m.datos.id_postulacion),
      ).length;
    assert.deepEqual(
      [recibioA(pos, "CAJERO"), recibioA(inventarios, "ALMACENERO"), recibioA(entregas, "CHOFER")],
      [1, 1, 1],
    );
    assert.deepEqual(
      [recibioA(pos, "ALMACENERO"), recibioA(pos, "CHOFER"), recibioA(inventarios, "CHOFER"), recibioA(entregas, "CAJERO")],
      [0, 0, 0, 0],
      "ningún sistema recibe altas que no le corresponden",
    );
    for (const sistema of [pos, inventarios, entregas]) {
      for (const mensaje of sistema.recibidos.values()) {
        assert.equal(mensaje.encabezado.destino.grupo, sistema.grupo);
        assert.deepEqual(mensaje.encabezado.origen, { grupo: "F", modulo: "RRHH" });
      }
    }
    assert.ok(broker.publicaciones.every((p) => p.topico === "ucb-sis323-sub-f"), "todo sale por el tópico único");
  });
});

describe("RF-14.8: recuperación ante fallas de los sistemas destino", () => {
  it("si Contabilidad no responde, reintenta con espera creciente hasta que la recibe", async () => {
    contabilidad.fallarSiguientes = 2;
    const { postulacion } = await contratar("CAJERO");
    await esperarHasta(() => estadoDe(postulacion.id_postulacion, "CONTABILIDAD") === "ENTREGADO", {
      descripcion: "la entrega a Contabilidad tras los reintentos",
    });
    const [evento] = eventosDe(postulacion.id_postulacion).filter((e) => e.id_destino === 1);
    assert.equal(evento.intentos, 3);
    assert.deepEqual(
      bandeja.esperas.filter((e) => e.idEvento === evento.id_evento).map((e) => e.esperaMs),
      [30000, 60000],
    );
    assert.ok(contabilidad.procesados.has(evento.id_mensaje));
  });

  it("si se pierde la respuesta de Contabilidad, el reintento no duplica el alta", async () => {
    contabilidad.perderRespuestas = 1;
    const procesadosAntes = contabilidad.procesados.size;
    const { postulacion } = await contratar("CHOFER");
    await esperarHasta(() => estadoDe(postulacion.id_postulacion, "CONTABILIDAD") === "ENTREGADO", {
      descripcion: "la entrega tras el 409",
    });
    assert.equal(contabilidad.procesados.size, procesadosAntes + 1, "Contabilidad la procesó una sola vez");
  });

  it("un rechazo de Contabilidad deja el alta FALLIDA y el reintento manual la entrega", async () => {
    contabilidad.rechazarSiguientes = 1;
    const { postulacion } = await contratar("ALMACENERO");
    await esperarHasta(() => estadoDe(postulacion.id_postulacion, "CONTABILIDAD") === "FALLIDO", {
      descripcion: "el alta fallida",
    });
    // Sigue fallida: un error permanente no se reintenta solo.
    await new Promise((listo) => setTimeout(listo, 100));
    assert.equal(estadoDe(postulacion.id_postulacion, "CONTABILIDAD"), "FALLIDO");

    const [evento] = eventosDe(postulacion.id_postulacion).filter((e) => e.id_destino === 1);
    await servicio.reintentar(evento.id_evento);
    await esperarHasta(() => estadoDe(postulacion.id_postulacion, "CONTABILIDAD") === "ENTREGADO", {
      descripcion: "la entrega tras el reintento manual",
    });
  });

  it("si Pub/Sub está caído, las altas operativas esperan y salen cuando vuelve", async () => {
    broker.caido = true;
    const { postulacion } = await contratar("CAJERO");
    await esperarHasta(
      () => eventosDe(postulacion.id_postulacion).find((e) => e.id_destino === 2)?.intentos >= 2,
      { descripcion: "los reintentos con Pub/Sub caído" },
    );
    assert.equal(estadoDe(postulacion.id_postulacion, "MARKETPLACE_POS"), "PENDIENTE");

    broker.caido = false;
    await esperarHasta(() => estadoDe(postulacion.id_postulacion, "MARKETPLACE_POS") === "ENTREGADO", {
      descripcion: "la publicación cuando Pub/Sub vuelve",
    });
    await esperarHasta(() =>
      [...pos.recibidos.values()].some((m) => m.datos.id_postulacion === postulacion.id_postulacion),
    );
  });
});
