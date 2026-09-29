module.exports = {
  // Zona horaria con la que se decide "hoy": fecha de publicación y vencimiento de convocatorias.
  zonaHoraria: process.env.APP_TIMEZONE || 'America/La_Paz',

  employeeServiceUrl: (process.env.EMPLOYEE_SERVICE_URL || 'http://employee-service:3002').replace(/\/+$/, ''),
  employeeServiceTimeoutMs: Number(process.env.EMPLOYEE_SERVICE_TIMEOUT_MS) || 5000,
};
