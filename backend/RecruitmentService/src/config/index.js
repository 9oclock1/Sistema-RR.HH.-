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
    esperaReintentoMs: 30 * 1000,
  },
};
