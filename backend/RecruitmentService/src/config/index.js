module.exports = {
  // Zona horaria con la que se decide "hoy": fecha de publicación y vencimiento de convocatorias.
  zonaHoraria: process.env.APP_TIMEZONE || "America/La_Paz",

  employeeServiceUrl: (
    process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002"
  ).replace(/\/+$/, ""),
  employeeServiceTimeoutMs:
    Number(process.env.EMPLOYEE_SERVICE_TIMEOUT_MS) || 5000,

  integracion: {
    urlsDestino: {
      CONTABILIDAD: process.env.URL_CONTABILIDAD || null,
      MARKETPLACE_POS: process.env.URL_MARKETPLACE_POS || null,
      INVENTARIOS: process.env.URL_INVENTARIOS || null,
      ENTREGAS: process.env.URL_ENTREGAS || null,
    },
    tiempoEsperaMs: Number(process.env.INTEGRACION_TIMEOUT_MS) || 5000,
    intervaloMs: Number(process.env.INTERVALO_EVENTOS_MS) || 5000,
    topicoPubSub: process.env.PUBSUB_TOPICO || "ucb-sis323-sub-f",
    tiempoPublicacionMs: Number(process.env.PUBSUB_TIMEOUT_MS) || 15000,
  },

  // RF-15: correo al candidato. Sin SMTP_HOST los avisos quedan pendientes en NOTIFICACIONES_ENTREVISTA.
  correo: {
    host: process.env.SMTP_HOST || null,
    puerto: Number(process.env.SMTP_PORT) || 587,
    seguro: process.env.SMTP_SECURE === "true",
    usuario: process.env.SMTP_USER || null,
    clave: process.env.SMTP_PASS || null,
    remitente: process.env.SMTP_FROM || process.env.SMTP_USER || null,
    tiempoEsperaMs: Number(process.env.SMTP_TIMEOUT_MS) || 10000,
    intervaloMs: Number(process.env.CORREO_INTERVALO_MS) || 5000,
  },
};
