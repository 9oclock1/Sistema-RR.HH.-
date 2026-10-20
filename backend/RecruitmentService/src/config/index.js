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

  // RF-15: los correos al candidato los envía NotificationService; aquí queda la cola con sus reintentos.
  notificaciones: {
    url: (process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3007").replace(/\/+$/, ""),
    tiempoEsperaMs: Number(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS) || 15000,
    intervaloMs: Number(process.env.CORREO_INTERVALO_MS) || 5000,
  },
};
