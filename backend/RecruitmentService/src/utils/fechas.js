const { zonaHoraria } = require('../config');

// 'YYYY-MM-DD' de hoy en la zona de la aplicación (la misma que usa la sesión de PostgreSQL).
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' });

const hoy = () => formato.format(new Date());

module.exports = { hoy };
