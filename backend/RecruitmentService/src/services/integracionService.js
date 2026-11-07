const modelo = require("../models/integracionModel");
const etapaModelo = require("../models/etapaPostulacionModel");
const clienteRest = require("./clienteRestErp");
const pubsub = require("../config/pubsub");
const HttpError = require("../utils/HttpError");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { integracion } = require("../config");
const {
  DESTINO,
  MAXIMO_INTENTOS,
  armarMensajesAlta,
  atributosDe,
  esperaReintento,
  errorDePublicacion,
  clasificarRespuestaRest,
} = require("../utils/integracion");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;

async function registrarAltaContratacion(
  client,
  { postulacion, cargo, usuario },
) {
  const alta = await modelo.obtenerDatosAlta(
    client,
    postulacion.id_postulacion,
  );
  const destinos = await modelo.listarDestinos(client);
  const mensajes = armarMensajesAlta({
    postulacion,
    alta,
    cargo,
    usuario,
    destinos,
  });

  const registrados = [];
  for (const mensaje of mensajes) {
    const evento = await modelo.registrar(client, {
      idMensaje: mensaje.idMensaje,
      idPostulacion: postulacion.id_postulacion,
      idDestino: mensaje.destino.id_destino,
      tipoEvento: mensaje.tipo,
      carga: mensaje.carga,
    });
    if (evento) {
      registrados.push({
        ...evento,
        codigo_destino: mensaje.destino.codigo,
        nombre_modulo: mensaje.destino.nombre_modulo,
      });
    }
  }
  return registrados;
}

// Un error permanente o el último intento dejan el evento FALLIDO; si no, se reintenta con espera creciente.
const registrarFallo = async (evento, { mensaje, permanente }) => {
  const intentos = evento.intentos + 1;
  const fallido = permanente || intentos >= MAXIMO_INTENTOS;
  console.error(
    `[Integración] Falló el envío a ${evento.codigo_destino} (evento ${evento.id_evento}, intento ${intentos}): ${mensaje}` +
      (fallido ? " — queda FALLIDO hasta un reintento manual." : ""),
  );
  await modelo.marcarError(evento.id_evento, { error: mensaje, esperaMs: esperaReintento(intentos), fallido });
};

const registrarEntrega = async (evento, via) => {
  await modelo.marcarEntregado(evento);
  console.log(
    `[Integración] Alta ${evento.tipo_evento} entregada a ${evento.codigo_destino} por ${via} (evento ${evento.id_evento})`,
  );
};

// Publica el mensaje en el tópico único de RRHH. El evento queda ENTREGADO cuando Pub/Sub confirma que lo guardó;
// desde ahí cada módulo lo lee de su suscripción.
async function publicar(clientePubSub, evento) {
  const topico = integracion.topicoPubSub;
  try {
    const idPubSub = await Promise.race([
      clientePubSub.topic(topico).publishMessage({ json: evento.carga, attributes: atributosDe(evento.carga) }),
      new Promise((_, rechazar) =>
        setTimeout(() => rechazar(new Error("Pub/Sub no respondió a tiempo")), integracion.tiempoPublicacionMs).unref(),
      ),
    ]);
    mensajesPublicados.registrar({
      topico,
      idPubSub,
      atributos: atributosDe(evento.carga),
      cuerpo: evento.carga,
    });
    await registrarEntrega(evento, `Pub/Sub (${topico}, mensaje ${idPubSub})`);
  } catch (error) {
    await registrarFallo(evento, errorDePublicacion(error, topico));
  }
}

/**
 * Con URL REST se usa primero. Si falla y el destino es un módulo operativo (canal PUBSUB), el mensaje sale por
 * Pub/Sub en ese mismo ciclo; Contabilidad (canal REST) espera al reintento. Sin URL se publica en Pub/Sub.
 */
async function entregar(evento, url, clientePubSub) {
  if (!url) return publicar(clientePubSub, evento);

  const respuesta = clasificarRespuestaRest(await clienteRest.enviar(evento, url));
  if (respuesta.entregado) return registrarEntrega(evento, "REST");
  if (evento.canal === "PUBSUB" && clientePubSub) {
    console.error(`[Integración] El endpoint de ${evento.codigo_destino} falló (${respuesta.mensaje}); se publica por Pub/Sub.`);
    return publicar(clientePubSub, evento);
  }
  return registrarFallo(evento, respuesta);
}

// Toma los eventos pendientes de los destinos que tienen algún camino (URL REST o Pub/Sub configurado).
async function despachar() {
  const urls = integracion.urlsDestino;
  const clientePubSub = pubsub.obtenerCliente();
  const codigos = Object.values(DESTINO).filter((codigo) => urls[codigo] || clientePubSub);
  if (codigos.length === 0) return 0;

  const eventos = await modelo.reservarPendientes(codigos, LOTE, SEGUNDOS_RESERVA);
  await Promise.all(eventos.map((evento) => entregar(evento, urls[evento.codigo_destino], clientePubSub)));
  return eventos.length;
}

function iniciarDespachador() {
  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await despachar();
    } catch (error) {
      console.error("[Integración] Error al despachar eventos:", error.message);
    } finally {
      ocupado = false;
    }
  }, integracion.intervaloMs).unref();
}

// Estado del alta en cada módulo, para confirmar al reclutador que el colaborador quedó registrado.
async function listarDePostulacion(idPostulacion) {
  const eventos = await modelo.listarPorPostulacion(idPostulacion);
  if (
    eventos.length === 0 &&
    !(await etapaModelo.existePostulacion(idPostulacion))
  ) {
    throw new HttpError(404, "La postulación indicada no existe.");
  }
  return eventos;
}

// Un reclutador reenvía un alta que agotó sus reintentos (p. ej. tras arreglar el endpoint del ERP).
async function reintentar(idEvento) {
  const evento = await modelo.obtener(idEvento);
  if (!evento) throw new HttpError(404, "El evento de integración indicado no existe.");
  if (!(await modelo.reencolar(idEvento))) {
    throw new HttpError(409, "Solo se pueden reintentar las altas que quedaron fallidas.", { estado: evento.estado });
  }
  return modelo.obtener(idEvento);
}

module.exports = {
  registrarAltaContratacion,
  despachar,
  iniciarDespachador,
  listarDePostulacion,
  reintentar,
};
