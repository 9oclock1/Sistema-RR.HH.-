const { randomUUID } = require("node:crypto");
const modelo = require("../models/cierresModel");
const pubsub = require("../config/pubsub");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { topicoPropio, asegurarTopico } = require("./eventos.service");
const { atributosDe, esperaReintento, errorDePublicacion } = require("../utils/integraciones");
const {
  simulacionCierreActiva,
  demoraSimulacionCierreMs,
  revocacionPlazoSegundos,
  armarRespuestaSimuladaCierre,
} = require("../utils/cierres");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;

const tiempoPublicacionMs = () => Number(process.env.PUBSUB_TIMEOUT_MS) || 15000;

let avisoSinPubSub = false;
const destinosSinRespuesta = new Set();

function establecerSinRespuesta(destino, activo) {
  if (activo) destinosSinRespuesta.add(destino);
  else destinosSinRespuesta.delete(destino);
  return obtenerDestinosSinRespuesta();
}

function obtenerDestinosSinRespuesta() {
  return [...destinosSinRespuesta];
}

const estaSinRespuesta = (destino) => destinosSinRespuesta.has(destino);

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

function entregarAlConsumidor(carga, { topico, idPubSub } = {}) {
  let consumidor;
  try {
    consumidor = require("./confirmacionesCierreService");
  } catch {
    return;
  }
  if (typeof consumidor?.recibirMensaje !== "function") return;
  consumidor.recibirMensaje(JSON.stringify(carga), { topico, idPubSub }).catch((err) => {
    console.error("[cierre] Error al entregar respuesta simulada al consumidor:", err.message);
  });
}

async function encolarRespuestaSimulada(evento) {
  const idCierre = evento.id_cierre;
  const idMensaje = randomUUID();
  const datosEnvio = evento.carga?.datos ?? {};
  const carga = armarRespuestaSimuladaCierre({
    idMensaje,
    destino: evento.destino,
    idCierre,
    idMensajeOrigen: evento.id_mensaje,
    resultado: "CONFIRMADA",
    accesosARevocar: datosEnvio.accesos_a_revocar ?? [],
    codigoEmpleado: datosEnvio.empleado?.codigo_empleado ?? "",
  });
  const proximoIntentoEn = new Date(Date.now() + demoraSimulacionCierreMs()).toISOString();
  await modelo.registrarEvento(require("../config/db"), {
    idMensaje,
    idCierre,
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

async function publicarEvento(clientePubSub, evento) {
  const atributos = atributosDe(evento.carga);
  try {
    const idPubSub = await publicarEnTopico(clientePubSub, evento, atributos);
    await modelo.marcarEventoEntregado(evento.id_evento, idPubSub);

    if (evento.sentido === "SALIENTE") {
      await modelo.marcarRevocacionEnviada(evento.id_cierre, evento.destino, revocacionPlazoSegundos());
      const { origen, destino } = evento.carga.encabezado;
      console.log(
        `[cierre] Envío ${origen.grupo} → ${destino.grupo} (${destino.modulo}) publicado en ${evento.topico} (mensaje ${idPubSub})`
      );
      mensajesPublicados.registrar({
        direccion: "publicado",
        topico: evento.topico,
        idPubSub,
        atributos,
        cuerpo: evento.carga,
      });
      if (simulacionCierreActiva() && !estaSinRespuesta(evento.destino)) {
        await encolarRespuestaSimulada(evento).catch((err) => {
          console.error("[cierre] No se pudo encolar la respuesta simulada:", err.message);
        });
      }
    } else if (evento.sentido === "RESPUESTA_SIMULADA") {
      const { origen, destino } = evento.carga?.encabezado ?? {};
      console.log(
        `[cierre] Respuesta simulada ${origen?.grupo ?? "?"} → ${destino?.grupo ?? "?"} (${origen?.modulo ?? "?"}) publicada en ${evento.topico} (mensaje ${idPubSub})`
      );
      entregarAlConsumidor(evento.carga, { topico: evento.topico, idPubSub });
    }
  } catch (error) {
    console.error(`[cierre] Error al publicar evento ${evento.id_evento} en ${evento.topico}:`, error.message);
    const { mensaje, permanente } = errorDePublicacion(error, evento.topico);
    await modelo.marcarEventoError(evento.id_evento, {
      error: mensaje,
      esperaMs: esperaReintento(evento.intentos + 1),
      fallido: permanente,
    });
  }
}

async function despacharCierres() {
  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) {
    if (!avisoSinPubSub) {
      avisoSinPubSub = true;
      console.warn(
        "[cierre] Pub/Sub no está configurado (GOOGLE_APPLICATION_CREDENTIALS o PUBSUB_EMULATOR_HOST): " +
          "los eventos de cierre quedan pendientes en la bandeja de salida."
      );
    }
    return 0;
  }

  const eventos = await modelo.reservarEventosPendientes(LOTE, SEGUNDOS_RESERVA);
  await Promise.all(eventos.map((evento) => publicarEvento(clientePubSub, evento)));
  return eventos.length;
}

function iniciarDespachadorCierres() {
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
      await despacharCierres();
    } catch (error) {
      console.error("[cierre] Error al despachar eventos:", error.message);
    } finally {
      ocupado = false;
    }
  }, intervalo).unref();
}

module.exports = {
  despacharCierres,
  iniciarDespachadorCierres,
  establecerSinRespuesta,
  obtenerDestinosSinRespuesta,
  estaSinRespuesta,
};
