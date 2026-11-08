const modelo = require("../models/eventos.model");
const pubsub = require("../config/pubsub");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { atributosDe, esperaReintento, errorDePublicacion } = require("../utils/integraciones");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;

// Todo lo que publica RRHH va al tópico propio del grupo F; cada destino filtra por los atributos.
const topicoPropio = () => process.env.PUBSUB_TOPICO || "ucb-sis323-sub-f";
// Sin tope, una publicación a Pub/Sub inalcanzable queda colgada y el evento no se reintenta.
const tiempoPublicacionMs = () => Number(process.env.PUBSUB_TIMEOUT_MS) || 15000;

const conLimiteDeTiempo = (promesa) =>
  Promise.race([
    promesa,
    new Promise((_, rechazar) =>
      setTimeout(() => rechazar(new Error("Pub/Sub no respondió a tiempo")), tiempoPublicacionMs()).unref()
    ),
  ]);

async function publicar(clientePubSub, evento) {
  const atributos = atributosDe(evento.carga);
  try {
    const idPubSub = await conLimiteDeTiempo(
      clientePubSub.topic(evento.topico).publishMessage({ json: evento.carga, attributes: atributos })
    );
    console.log(`Evento ${evento.id_evento} publicado en ${evento.topico} (mensaje ${idPubSub})`);
    mensajesPublicados.registrar({ topico: evento.topico, idPubSub, atributos, cuerpo: evento.carga });
    await modelo.marcarEntregado(evento.id_evento);
  } catch (error) {
    console.error(`Error al publicar el evento ${evento.id_evento} en ${evento.topico}:`, error.message);
    const { mensaje, permanente } = errorDePublicacion(error, evento.topico);
    await modelo.marcarError(evento.id_evento, {
      error: mensaje,
      esperaMs: esperaReintento(evento.intentos + 1),
      fallido: permanente,
    });
  }
}

// Criterio 5: sin Pub/Sub configurado o alcanzable, los eventos quedan pendientes en la base y se reintentan.
async function despachar() {
  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) return 0;
  const eventos = await modelo.reservarPendientes(LOTE, SEGUNDOS_RESERVA);
  await Promise.all(eventos.map((evento) => publicar(clientePubSub, evento)));
  return eventos.length;
}

function iniciarDespachador() {
  const intervalo = Number(process.env.INTERVALO_EVENTOS_MS) || 5000;
  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await despachar();
    } catch (error) {
      console.error("Error al despachar eventos:", error.message);
    } finally {
      ocupado = false;
    }
  }, intervalo).unref();
}

module.exports = { topicoPropio, despachar, iniciarDespachador };
