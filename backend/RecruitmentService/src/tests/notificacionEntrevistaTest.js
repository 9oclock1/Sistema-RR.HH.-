// KAN-35 (RF-15.6): verificación del envío de los correos de entrevista.
// La cola NOTIFICACIONES_ENTREVISTA se simula en memoria con sus mismas reglas y el despachador real la procesa.
// NotificationService se reemplaza por un servidor HTTP local que registra cada aviso recibido (no sale ningún correo).
const { describe, it, before, after, beforeEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const path = require("node:path");
const { randomUUID } = require("node:crypto");

const clienteFalso = { query: async () => ({ rows: [] }) };
const rutaTransaccion = require.resolve(path.join(__dirname, "../utils/transaction"));
require.cache[rutaTransaccion] = {
  id: rutaTransaccion,
  filename: rutaTransaccion,
  loaded: true,
  exports: { withTransaction: async (trabajo) => trabajo(clienteFalso) },
};

const { notificaciones: configuracion } = require("../config");
const modelo = require("../models/notificacionEntrevistaModel");
const servicio = require("../services/notificacionEntrevistaService");
const { ESTADO_EVENTO, MAXIMO_INTENTOS } = require("../utils/integracion");
const { TIPO_NOTIFICACION } = require("../utils/entrevistas");

const ESTADO = Object.fromEntries(Object.entries(ESTADO_EVENTO).map(([nombre, id]) => [id, nombre]));
const ID_ENTREVISTA = "55555555-5555-4555-8555-000000000001";

const entrevista = (cambios = {}) => ({
  id_entrevista: ID_ENTREVISTA,
  nombres: "Luis",
  apellidos: "Rojas",
  correo_electronico: "luis@test.com",
  titulo_puesto: "Cajero",
  codigo_convocatoria: "CONV-01",
  fecha_hora_programada: new Date("2030-03-15T14:00:00Z"),
  duracion_minutos: 45,
  modalidad: "VIRTUAL",
  lugar_enlace: "https://meet.google.com/abc",
  nombre_entrevistador: "Ana Quispe",
  ...cambios,
});

// ── Cola en memoria (NOTIFICACIONES_ENTREVISTA) ──
let cola;

function instalarCola() {
  cola = [];
  const buscar = (id) => cola.find((n) => n.id_notificacion === id);
  mock.method(modelo, "descartarPendientes", async (cliente, idEntrevista) =>
    cola
      .filter((n) => n.id_entrevista === idEntrevista && [ESTADO_EVENTO.PENDIENTE, ESTADO_EVENTO.FALLIDO].includes(n.id_estado_evento))
      .map((n) => {
        n.id_estado_evento = ESTADO_EVENTO.DESCARTADO;
        return n.tipo_notificacion;
      }),
  );
  mock.method(modelo, "huboEntrega", async (cliente, idEntrevista) =>
    cola.some((n) => n.id_entrevista === idEntrevista && n.id_estado_evento === ESTADO_EVENTO.ENTREGADO),
  );
  mock.method(modelo, "registrar", async (cliente, { idEntrevista, tipo, correo, carga }) => {
    const nueva = {
      id_notificacion: randomUUID(),
      id_entrevista: idEntrevista,
      tipo_notificacion: tipo,
      correo_destino: correo,
      carga,
      id_estado_evento: ESTADO_EVENTO.PENDIENTE,
      intentos: 0,
      ultimo_error: null,
      proximo_intento_en: Date.now(),
    };
    cola.push(nueva);
    return { ...nueva, codigo_estado: "PENDIENTE" };
  });
  mock.method(modelo, "reservarPendientes", async (limite, segundos) => {
    const ahora = Date.now();
    const reservadas = cola
      .filter((n) => n.id_estado_evento === ESTADO_EVENTO.PENDIENTE && n.proximo_intento_en <= ahora)
      .slice(0, limite);
    reservadas.forEach((n) => (n.proximo_intento_en = ahora + segundos * 1000));
    return reservadas.map((n) => n.id_notificacion);
  });
  mock.method(modelo, "bloquearParaEnvio", async (cliente, id) => {
    const n = buscar(id);
    return n && n.id_estado_evento === ESTADO_EVENTO.PENDIENTE ? { ...n } : null;
  });
  mock.method(modelo, "marcarEnviada", async (cliente, aviso) => {
    const n = buscar(aviso.id_notificacion);
    n.id_estado_evento = ESTADO_EVENTO.ENTREGADO;
    n.intentos += 1;
    n.ultimo_error = null;
  });
  mock.method(modelo, "marcarError", async (cliente, id, { error, esperaMs, fallido }) => {
    const n = buscar(id);
    n.intentos += 1;
    n.ultimo_error = error;
    n.espera = esperaMs;
    n.proximo_intento_en = Date.now() + esperaMs;
    if (fallido) n.id_estado_evento = ESTADO_EVENTO.FALLIDO;
  });
  mock.method(modelo, "reencolar", async (id) => {
    const n = buscar(id);
    if (n?.id_estado_evento !== ESTADO_EVENTO.FALLIDO) return false;
    Object.assign(n, { id_estado_evento: ESTADO_EVENTO.PENDIENTE, intentos: 0, ultimo_error: null, proximo_intento_en: Date.now() });
    return true;
  });
  mock.method(modelo, "obtener", async (id) => {
    const n = buscar(id);
    return n ? { ...n, codigo_estado: ESTADO[n.id_estado_evento] } : null;
  });
}

// Adelanta el reloj de la cola: los avisos en espera de reintento quedan listos.
const vencerEsperas = () => cola.forEach((n) => (n.proximo_intento_en = 0));
const estadoDe = (n) => ESTADO[n.id_estado_evento];

// ── NotificationService simulado ──
const notificationService = { recibidos: [], respuesta: { estado: 200 } };
let servidor;

before(async () => {
  servidor = http.createServer((req, res) => {
    let cuerpo = "";
    req.on("data", (parte) => (cuerpo += parte));
    req.on("end", () => {
      notificationService.recibidos.push({ ruta: req.url, servicio: req.headers["x-servicio"], cuerpo: JSON.parse(cuerpo) });
      const { estado, error } = notificationService.respuesta;
      res.writeHead(estado, { "Content-Type": "application/json" });
      res.end(JSON.stringify(estado === 200 ? { enviado: true } : { error }));
    });
  });
  await new Promise((listo) => servidor.listen(0, "127.0.0.1", listo));
  configuracion.url = `http://127.0.0.1:${servidor.address().port}`;
});

after(() => servidor.close());

beforeEach(() => {
  mock.restoreAll();
  instalarCola();
  notificationService.recibidos = [];
  notificationService.respuesta = { estado: 200 };
  mock.method(console, "log", () => {});
  mock.method(console, "error", () => {});
});

describe("RF-15.6: qué aviso se encola en cada cambio", () => {
  it("la programación guarda los datos de la cita que lleva el correo", async () => {
    const aviso = await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    assert.equal(aviso.tipo_notificacion, TIPO_NOTIFICACION.PROGRAMACION);
    assert.equal(aviso.correo_destino, "luis@test.com");
    assert.deepEqual(aviso.carga, {
      candidato: { nombres: "Luis", apellidos: "Rojas" },
      puesto: "Cajero",
      codigo_convocatoria: "CONV-01",
      fecha_hora: "2030-03-15T14:00:00.000Z",
      duracion_minutos: 45,
      modalidad: "VIRTUAL",
      lugar_enlace: "https://meet.google.com/abc",
      evaluador: "Ana Quispe",
      fecha_hora_anterior: null,
      motivo: null,
    });
  });

  it("si el candidato no recibió la citación, la reprogramación se le envía como programación con los datos nuevos", async () => {
    await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    const historial = { fecha_hora_anterior: new Date("2030-03-15T14:00:00Z"), motivo: "Viaje" };
    const aviso = await servicio.encolar(clienteFalso, {
      entrevista: entrevista({ fecha_hora_programada: new Date("2030-03-16T13:00:00Z") }),
      tipo: TIPO_NOTIFICACION.REPROGRAMACION,
      historial,
    });
    assert.deepEqual(cola.map(estadoDe), ["DESCARTADO", "PENDIENTE"]);
    assert.equal(aviso.tipo_notificacion, TIPO_NOTIFICACION.PROGRAMACION);
    assert.equal(aviso.carga.fecha_hora, "2030-03-16T13:00:00.000Z");
    assert.equal(aviso.carga.motivo, null);
  });

  it("criterio 4: si ya recibió la citación, la reprogramación lleva la fecha anterior y el motivo", async () => {
    await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    await servicio.despachar();
    const aviso = await servicio.encolar(clienteFalso, {
      entrevista: entrevista({ fecha_hora_programada: new Date("2030-03-16T13:00:00Z") }),
      tipo: TIPO_NOTIFICACION.REPROGRAMACION,
      historial: { fecha_hora_anterior: new Date("2030-03-15T14:00:00Z"), motivo: "Viaje" },
    });
    assert.equal(aviso.tipo_notificacion, TIPO_NOTIFICACION.REPROGRAMACION);
    assert.equal(aviso.carga.fecha_hora_anterior, "2030-03-15T14:00:00.000Z");
    assert.equal(aviso.carga.motivo, "Viaje");
  });

  it("cancelar una cita cuya citación no salió no envía nada al candidato", async () => {
    await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    const aviso = await servicio.encolar(clienteFalso, {
      entrevista: entrevista(),
      tipo: TIPO_NOTIFICACION.CANCELACION,
      historial: { motivo: "Error de carga" },
    });
    assert.equal(aviso, null);
    assert.equal(await servicio.despachar(), 0);
    assert.equal(notificationService.recibidos.length, 0);
  });
});

describe("RF-15.6: envío por NotificationService y reintentos", () => {
  it("criterio 2: al terminar el guardado el aviso llega a NotificationService con los datos de acceso", async () => {
    const aviso = await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    assert.equal(await servicio.despachar(), 1);

    assert.equal(notificationService.recibidos.length, 1);
    const [recibido] = notificationService.recibidos;
    assert.equal(recibido.ruta, "/correos/entrevistas");
    assert.equal(recibido.servicio, "recruitment-service");
    assert.equal(recibido.cuerpo.id_mensaje, aviso.id_notificacion);
    assert.equal(recibido.cuerpo.para, "luis@test.com");
    assert.equal(recibido.cuerpo.tipo, "PROGRAMACION");
    assert.equal(recibido.cuerpo.datos.lugar_enlace, "https://meet.google.com/abc");
    assert.equal(estadoDe(cola[0]), "ENTREGADO");
  });

  it("un aviso entregado no se vuelve a enviar", async () => {
    await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    await servicio.despachar();
    vencerEsperas();
    await servicio.despachar();
    assert.equal(notificationService.recibidos.length, 1);
  });

  it("si el correo está caído (503) se reintenta con espera creciente hasta que sale", async () => {
    notificationService.respuesta = { estado: 503, error: "El servidor de correo no respondió." };
    await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    const esperas = [];
    for (let i = 0; i < 3; i++) {
      await servicio.despachar();
      esperas.push(cola[0].espera);
      vencerEsperas();
    }
    assert.equal(estadoDe(cola[0]), "PENDIENTE");
    assert.equal(cola[0].intentos, 3);
    assert.equal(cola[0].ultimo_error, "El servidor de correo no respondió.");
    assert.ok(esperas[0] < esperas[1] && esperas[1] < esperas[2], `esperas crecientes: ${esperas}`);

    notificationService.respuesta = { estado: 200 };
    await servicio.despachar();
    assert.equal(estadoDe(cola[0]), "ENTREGADO");
    assert.equal(notificationService.recibidos.length, 4);
  });

  it("si NotificationService no responde, el aviso queda pendiente para reintentar", async () => {
    const url = configuracion.url;
    configuracion.url = "http://127.0.0.1:1";
    try {
      await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
      await servicio.despachar();
      assert.equal(estadoDe(cola[0]), "PENDIENTE");
      assert.match(cola[0].ultimo_error, /NotificationService no responde/);
    } finally {
      configuracion.url = url;
    }
  });

  it("una dirección rechazada (422) queda FALLIDA sin reintentos, y el reintento manual la vuelve a enviar", async () => {
    notificationService.respuesta = { estado: 422, error: "El servidor de correo respondió 550: mailbox unavailable" };
    const aviso = await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    await servicio.despachar();
    assert.equal(estadoDe(cola[0]), "FALLIDO");
    assert.equal(cola[0].intentos, 1);

    vencerEsperas();
    assert.equal(await servicio.despachar(), 0, "un aviso fallido no se reintenta solo");

    notificationService.respuesta = { estado: 200 };
    const reencolado = await servicio.reintentar(aviso.id_notificacion);
    assert.equal(reencolado.codigo_estado, "PENDIENTE");
    await servicio.despachar();
    assert.equal(estadoDe(cola[0]), "ENTREGADO");
  });

  it("al agotar los intentos el aviso queda FALLIDO", async () => {
    notificationService.respuesta = { estado: 503, error: "SMTP caído" };
    await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    for (let i = 0; i < MAXIMO_INTENTOS; i++) {
      await servicio.despachar();
      vencerEsperas();
    }
    assert.equal(estadoDe(cola[0]), "FALLIDO");
    assert.equal(cola[0].intentos, MAXIMO_INTENTOS);
  });

  it("el reintento manual solo aplica a avisos fallidos", async () => {
    const aviso = await servicio.encolar(clienteFalso, { entrevista: entrevista(), tipo: TIPO_NOTIFICACION.PROGRAMACION });
    await assert.rejects(servicio.reintentar(aviso.id_notificacion), { status: 409 });
    await assert.rejects(servicio.reintentar(randomUUID()), { status: 404 });
  });
});
