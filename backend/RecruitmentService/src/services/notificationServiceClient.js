const { notificaciones } = require("../config");

class ErrorEnvioCorreo extends Error {
  constructor(mensaje, permanente) {
    super(mensaje);
    this.name = "ErrorEnvioCorreo";
    this.permanente = permanente;
  }
}

/**
 * RF-15: pide a NotificationService que envíe al candidato el correo de su entrevista.
 * Lanza ErrorEnvioCorreo: permanente si la dirección o el aviso fueron rechazados (4xx); si no, se puede reintentar.
 */
async function enviarAvisoEntrevista({ idMensaje, para, tipo, datos }) {
  let respuesta;
  try {
    respuesta = await fetch(`${notificaciones.url}/correos/entrevistas`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json", "X-Servicio": "recruitment-service" },
      body: JSON.stringify({ id_mensaje: idMensaje, para, tipo, datos }),
      signal: AbortSignal.timeout(notificaciones.tiempoEsperaMs),
    });
  } catch (error) {
    throw new ErrorEnvioCorreo(`NotificationService no responde: ${error.message}`, false);
  }

  const cuerpo = await respuesta.json().catch(() => null);
  if (respuesta.ok) return cuerpo;
  const mensaje = cuerpo?.error || `NotificationService respondió ${respuesta.status}.`;
  // 4xx: el aviso o el destinatario no son válidos, reintentar no cambia nada. 5xx: correo caído o error temporal.
  throw new ErrorEnvioCorreo(mensaje, respuesta.status >= 400 && respuesta.status < 500);
}

module.exports = { enviarAvisoEntrevista, ErrorEnvioCorreo };
