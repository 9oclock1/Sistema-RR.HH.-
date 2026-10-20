const modelo = require("../models/integracionModel");
const etapaModelo = require("../models/etapaPostulacionModel");
const clienteRest = require("./clienteRestErp");
const pubsub = require("../config/pubsub");
const HttpError = require("../utils/HttpError");
const { integracion } = require("../config");
const { DESTINO, armarMensajesAlta, atributosDe, errorDePublicacion } = require("../utils/integracion");

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

const registrarFallo = async (evento, error) => {
  console.error(`[Integración] Falló el envío a ${evento.codigo_destino} (evento ${evento.id_evento}): ${error}`);
  await modelo.marcarError(evento.id_evento, { error, esperaMs: integracion.esperaReintentoMs });
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

  const resultado = await clienteRest.enviar(evento, url);
  if (resultado.ok) return registrarEntrega(evento, "REST");
  if (evento.canal === "PUBSUB" && clientePubSub) {
    console.error(`[Integración] El endpoint de ${evento.codigo_destino} falló (${resultado.error}); se publica por Pub/Sub.`);
    return publicar(clientePubSub, evento);
  }
  return registrarFallo(evento, resultado.error);
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

module.exports = {
  registrarAltaContratacion,
  despachar,
  iniciarDespachador,
  listarDePostulacion,
};
