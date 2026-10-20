const nodemailer = require("nodemailer");
const { correo } = require("../config");

let transporte = null;

const estaConfigurado = () => Boolean(correo.host);

function obtenerTransporte() {
  if (!estaConfigurado()) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: correo.host,
      port: correo.puerto,
      secure: correo.seguro,
      auth: correo.usuario ? { user: correo.usuario, pass: correo.clave } : undefined,
      connectionTimeout: correo.tiempoEsperaMs,
      greetingTimeout: correo.tiempoEsperaMs,
      socketTimeout: correo.tiempoEsperaMs,
    });
  }
  return transporte;
}

// Una dirección rechazada no se arregla reintentando; la red, el servidor o las credenciales, sí.
function clasificarError(error) {
  const permanente =
    error?.code === "EENVELOPE" || (error?.responseCode >= 550 && error?.responseCode <= 554 && error?.code !== "EAUTH");
  const motivo =
    error?.code === "EAUTH"
      ? "El servidor de correo rechazó las credenciales SMTP."
      : error?.responseCode
        ? `El servidor de correo respondió ${error.responseCode}: ${error.message}`
        : `No se pudo contactar al servidor de correo: ${error?.message ?? "error desconocido"}`;
  return { permanente, mensaje: motivo };
}

// Lanza el error de nodemailer si el servidor no acepta el correo; quien llama decide si reintenta.
async function enviar({ para, asunto, texto, html }) {
  const smtp = obtenerTransporte();
  if (!smtp) throw new Error("El envío de correos no está configurado (SMTP_HOST).");
  const info = await smtp.sendMail({ from: correo.remitente, to: para, subject: asunto, text: texto, html });
  return info.messageId;
}

module.exports = { estaConfigurado, enviar, clasificarError };
