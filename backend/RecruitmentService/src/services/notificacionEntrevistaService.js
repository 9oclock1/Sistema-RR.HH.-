const modelo = require("../models/notificacionEntrevistaModel");
const correoService = require("./correoService");
const HttpError = require("../utils/HttpError");
const { withTransaction } = require("../utils/transaction");
const { correo } = require("../config");
const { MAXIMO_INTENTOS, esperaReintento } = require("../utils/integracion");
const { TIPO_NOTIFICACION } = require("../utils/entrevistas");
const { armarCarga, armarCorreo } = require("../utils/plantillasEntrevista");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;

/**
 * Deja en cola el correo al candidato, dentro de la transacción que guardó el cambio de la cita.
 * Los avisos que aún no salieron se descartan: el candidato solo recibe los datos vigentes. Si todavía no recibió
 * ningún correo de esta entrevista, una reprogramación se le comunica como programación y una cancelación no se le
 * envía (nunca supo de la cita). Devuelve el aviso encolado, o null si no corresponde avisar.
 */
async function encolar(client, { entrevista, tipo, historial }) {
  await modelo.descartarPendientes(client, entrevista.id_entrevista);
  let tipoAviso = tipo;
  if (tipo !== TIPO_NOTIFICACION.PROGRAMACION && !(await modelo.huboEntrega(client, entrevista.id_entrevista))) {
    if (tipo === TIPO_NOTIFICACION.CANCELACION) return null;
    tipoAviso = TIPO_NOTIFICACION.PROGRAMACION;
  }
  return modelo.registrar(client, {
    idEntrevista: entrevista.id_entrevista,
    tipo: tipoAviso,
    correo: entrevista.correo_electronico,
    carga: armarCarga({ entrevista, historial: tipoAviso === TIPO_NOTIFICACION.PROGRAMACION ? null : historial }),
  });
}

// Un error permanente o el último intento dejan el aviso FALLIDO; si no, se reintenta con espera creciente.
async function enviarUna(idNotificacion) {
  await withTransaction(async (client) => {
    const aviso = await modelo.bloquearParaEnvio(client, idNotificacion);
    if (!aviso) return;

    try {
      const { asunto, texto, html } = armarCorreo(aviso.tipo_notificacion, aviso.carga);
      const idMensaje = await correoService.enviar({ para: aviso.correo_destino, asunto, texto, html });
      await modelo.marcarEnviada(client, aviso);
      console.log(`[Correo] Aviso ${aviso.tipo_notificacion} enviado a ${aviso.correo_destino} (${idMensaje})`);
    } catch (error) {
      const { permanente, mensaje } = correoService.clasificarError(error);
      const intentos = aviso.intentos + 1;
      const fallido = permanente || intentos >= MAXIMO_INTENTOS;
      console.error(
        `[Correo] Falló el aviso ${aviso.tipo_notificacion} a ${aviso.correo_destino} (intento ${intentos}): ${mensaje}` +
          (fallido ? " — queda FALLIDO hasta un reintento manual." : ""),
      );
      await modelo.marcarError(client, idNotificacion, { error: mensaje, esperaMs: esperaReintento(intentos), fallido });
    }
  });
}

// Uno por uno: el servidor SMTP limita los envíos simultáneos y cada envío retiene el bloqueo de su entrevista.
async function despachar() {
  if (!correoService.estaConfigurado()) return 0;
  const ids = await modelo.reservarPendientes(LOTE, SEGUNDOS_RESERVA);
  for (const id of ids) {
    await enviarUna(id);
  }
  return ids.length;
}

function iniciarDespachador() {
  if (!correoService.estaConfigurado()) {
    console.warn("[Correo] SMTP_HOST no está configurado: los avisos de entrevista quedarán pendientes.");
  }
  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await despachar();
    } catch (error) {
      console.error("[Correo] Error al despachar avisos de entrevista:", error.message);
    } finally {
      ocupado = false;
    }
  }, correo.intervaloMs).unref();
}

// Un reclutador reenvía un aviso que agotó sus reintentos (p. ej. tras corregir el correo SMTP).
async function reintentar(idNotificacion) {
  const aviso = await modelo.obtener(idNotificacion);
  if (!aviso) throw new HttpError(404, "La notificación indicada no existe.");
  if (!(await modelo.reencolar(idNotificacion))) {
    throw new HttpError(409, "Solo se pueden reintentar los avisos que quedaron fallidos.", {
      estado: aviso.codigo_estado,
    });
  }
  return modelo.obtener(idNotificacion);
}

module.exports = {
  encolar,
  despachar,
  iniciarDespachador,
  reintentar,
  listarPorEntrevista: modelo.listarPorEntrevista,
};
