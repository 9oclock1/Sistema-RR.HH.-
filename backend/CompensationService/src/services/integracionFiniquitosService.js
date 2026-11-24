const { randomUUID } = require("node:crypto");
const modelo = require("../models/finiquitosModel");
const pubsub = require("../config/pubsub");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { topicoPropio, asegurarTopico } = require("./eventos.service");
const { atributosDe, esperaReintento, errorDePublicacion } = require("../utils/integraciones");
const {
  simulacionFiniquitoActiva,
  demoraSimulacionFiniquitoMs,
  armarRespuestaSimulada,
} = require("../utils/finiquitos");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;
const ESPERA_CAIDA_SIMULADA_MS = 5000;

const tiempoPublicacionMs = () => Number(process.env.PUBSUB_TIMEOUT_MS) || 15000;

let avisoSinPubSub = false;
let caidaSimuladaHasta = null;

function activarCaidaBroker(segundos) {
  const hasta = new Date(Date.now() + segundos * 1000);
  caidaSimuladaHasta = hasta.getTime();
  return { hasta: hasta.toISOString() };
}

function obtenerCaidaBroker() {
  if (!caidaSimuladaHasta || Date.now() >= caidaSimuladaHasta) {
    caidaSimuladaHasta = null;
    return null;
  }
  return new Date(caidaSimuladaHasta).toISOString();
}

const caidaActiva = () => Boolean(obtenerCaidaBroker());

async function conLimiteDeTiempo(promesa) {
  let temporizador;
  const limite = new Promise((_, rechazar) => {
    temporizador = setTimeout(() => rechazar(new Error("Pub/Sub no respondió a tiempo")), tiempoPublicacionMs());
    if (typeof temporizador.unref === "function") temporizador.unref();
  });
  try {
    return await Promise.race([promesa, limite]);
  } finally {
    clearTimeout(temporizador);
  }
}

function entregarAlConsumidor(carga) {
  let consumidor;
  try {
    consumidor = require("./confirmacionesFiniquitoService");
  } catch {
    return;
  }
  if (typeof consumidor?.recibirMensaje !== "function") return;
  consumidor.recibirMensaje(JSON.stringify(carga)).catch((err) => {
    console.error("[finiquito] Error al entregar respuesta simulada al consumidor:", err.message);
  });
}

async function encolarRespuestaSimulada(evento) {
  const idFiniquito = evento.id_finiquito;
  const idMensaje = randomUUID();
  const numeroDoc = evento.carga?.datos?.numero_documento ?? "";
  const prefijoRef = evento.destino === "PAGOS" ? "OP" : "AS";
  const carga = armarRespuestaSimulada({
    idMensaje,
    destino: evento.destino,
    idFiniquito,
    idMensajeOrigen: evento.id_mensaje,
    resultado: "CONFIRMADA",
    referencia: `${prefijoRef}-${numeroDoc || idFiniquito.slice(0, 8).toUpperCase()}`,
  });
  const proximoIntentoEn = new Date(Date.now() + demoraSimulacionFiniquitoMs()).toISOString();
  await modelo.registrarEvento(require("../config/db"), {
    idMensaje,
    idFiniquito,
    sentido: "RESPUESTA_SIMULADA",
    destino: evento.destino,
    tipoEvento: carga.encabezado.tipo,
    topico: topicoPropio(),
    carga,
    proximoIntentoEn,
  });
}

const aseguramientosTopico = new Map();

async function asegurarTopicoEmulador(clientePubSub, topico) {
  if (!process.env.PUBSUB_EMULATOR_HOST) return false;
  if (!aseguramientosTopico.has(topico)) {
    const promesa = (async () => {
      if (await asegurarTopico(clientePubSub, topico)) return true;
      try {
        await clientePubSub.topic(topico).get();
        return true;
      } catch {
        return false;
      }
    })().finally(() => {
      aseguramientosTopico.delete(topico);
    });
    aseguramientosTopico.set(topico, promesa);
  }
  return aseguramientosTopico.get(topico);
}

async function publicarEnTopico(clientePubSub, evento, atributos) {
  const publicar = () =>
    conLimiteDeTiempo(
      clientePubSub.topic(evento.topico).publishMessage({ json: evento.carga, attributes: atributos })
    );
  try {
    return await publicar();
  } catch (error) {
    // El emulador de Pub/Sub guarda los tópicos en memoria; si se reinició, se vuelve a crear al publicar.
    if (
      process.env.PUBSUB_EMULATOR_HOST &&
      error?.code === 5 &&
      (await asegurarTopicoEmulador(clientePubSub, evento.topico))
    ) {
      return publicar();
    }
    throw error;
  }
}

// AC3, AC5: publica en el tópico F de RRHH y maneja reintentos sin perder eventos.
async function publicarEvento(clientePubSub, evento) {
  if (caidaActiva()) {
    const error = "Pub/Sub no disponible (caída simulada)";
    console.error(`[finiquito] Fallo simulado al publicar evento ${evento.id_evento}: ${error}`);
    await modelo.marcarEventoError(evento.id_evento, {
      error,
      esperaMs: ESPERA_CAIDA_SIMULADA_MS,
      fallido: false,
    });
    return;
  }

  const atributos = atributosDe(evento.carga);
  try {
    const idPubSub = await publicarEnTopico(clientePubSub, evento, atributos);
    await modelo.marcarEventoEntregado(evento.id_evento, idPubSub);

    if (evento.sentido === "SALIENTE") {
      const { origen, destino } = evento.carga.encabezado;
      console.log(
        `[finiquito] Envío ${origen.grupo} → ${destino.grupo} (${destino.modulo}) publicado en ${evento.topico} (mensaje ${idPubSub})`
      );
      mensajesPublicados.registrar({
        direccion: "publicado",
        topico: evento.topico,
        idPubSub,
        atributos,
        cuerpo: evento.carga,
      });
      if (simulacionFiniquitoActiva()) {
        await encolarRespuestaSimulada(evento).catch((err) => {
          console.error("[finiquito] No se pudo encolar la respuesta simulada:", err.message);
        });
      }
    } else if (evento.sentido === "RESPUESTA_SIMULADA") {
      entregarAlConsumidor(evento.carga);
    }
  } catch (error) {
    console.error(`[finiquito] Error al publicar evento ${evento.id_evento} en ${evento.topico}:`, error.message);
    const { mensaje, permanente } = errorDePublicacion(error, evento.topico);
    await modelo.marcarEventoError(evento.id_evento, {
      error: mensaje,
      esperaMs: esperaReintento(evento.intentos + 1),
      fallido: permanente,
    });
  }
}

async function despacharFiniquitos() {
  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) {
    if (!avisoSinPubSub) {
      avisoSinPubSub = true;
      console.warn(
        "[finiquito] Pub/Sub no está configurado (GOOGLE_APPLICATION_CREDENTIALS o PUBSUB_EMULATOR_HOST): " +
          "los eventos de finiquito quedan pendientes en la bandeja de salida."
      );
    }
    return 0;
  }

  const eventos = await modelo.reservarEventosPendientes(LOTE, SEGUNDOS_RESERVA);
  await Promise.all(eventos.map((evento) => publicarEvento(clientePubSub, evento)));
  return eventos.length;
}

function iniciarDespachadorFiniquitos() {
  const intervalo = Number(process.env.INTERVALO_EVENTOS_MS) || 5000;
  const clientePubSub = pubsub.obtenerCliente();
  if (clientePubSub) {
    asegurarTopico(clientePubSub, topicoPropio());
  }
  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await despacharFiniquitos();
    } catch (error) {
      console.error("[finiquito] Error al despachar eventos:", error.message);
    } finally {
      ocupado = false;
    }
  }, intervalo).unref();
}

module.exports = {
  despacharFiniquitos,
  iniciarDespachadorFiniquitos,
  activarCaidaBroker,
  obtenerCaidaBroker,
};
