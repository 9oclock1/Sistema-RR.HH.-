const ZONA_HORARIA = process.env.APP_TIMEZONE || 'America/La_Paz';
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

const hoyEnZona = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA_HORARIA, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ahora);

const esFechaIso = (texto) => {
  if (typeof texto !== 'string' || !FECHA_ISO.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
};

const formatearFecha = (iso) => (typeof iso === 'string' && FECHA_ISO.test(iso) ? iso.split('-').reverse().join('/') : '');

module.exports = { hoyEnZona, esFechaIso, formatearFecha };
