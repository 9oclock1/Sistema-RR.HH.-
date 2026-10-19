const nodemailer = require("nodemailer");

const TIEMPO_ESPERA_MS = 10000;

let transporte = null;

// El transporte se arma con la configuración SMTP del entorno; sin SMTP_HOST el correo queda deshabilitado.
function obtenerTransporte() {
  if (!process.env.SMTP_HOST) return null;
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      connectionTimeout: TIEMPO_ESPERA_MS,
      greetingTimeout: TIEMPO_ESPERA_MS,
      socketTimeout: TIEMPO_ESPERA_MS,
    });
  }
  return transporte;
}

// Envía un aviso por correo. Nunca lanza: el mensaje ya quedó en la bandeja del portal,
// así que el resultado solo informa si el correo salió y, si no, por qué.
async function enviarCorreo({ para, asunto, texto }) {
  if (!para) return { enviado: false, motivo: "El destinatario no tiene un correo registrado." };

  const smtp = obtenerTransporte();
  if (!smtp) {
    console.info(`[correo deshabilitado] Para: ${para} | Asunto: ${asunto}`);
    return { enviado: false, motivo: "El envío de correos no está configurado (SMTP_HOST)." };
  }

  try {
    await smtp.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: para,
      subject: asunto,
      text: texto,
    });
    return { enviado: true, motivo: null };
  } catch (error) {
    console.error(`No se pudo enviar el correo a ${para}:`, error.message);
    return { enviado: false, motivo: "El servidor de correo rechazó o no respondió al envío." };
  }
}

module.exports = { enviarCorreo };
