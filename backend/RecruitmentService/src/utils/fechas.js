const { zonaHoraria } = require('../config');

// 'YYYY-MM-DD' de hoy en la zona de la aplicación (la misma que usa la sesión de PostgreSQL).
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' });

const hoy = () => formato.format(new Date());

// 'YYYY-MM-DDTHH:mm[:ss]' con zona opcional ('Z' o '±HH:mm').
const FECHA_HORA_REGEX = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;

const formatoDesfase = new Intl.DateTimeFormat('en-US', { timeZone: zonaHoraria, timeZoneName: 'longOffset' });

// Minutos que la zona de la aplicación está adelantada respecto a UTC en ese instante (La Paz: -240).
const desfaseMinutos = (instante) => {
  const nombre = formatoDesfase.formatToParts(instante).find((parte) => parte.type === 'timeZoneName').value;
  const [, signo, horas, minutos = '0'] = /GMT(?:([+-])(\d{2}):?(\d{2})?)?/.exec(nombre) || [];
  if (!signo) return 0;
  return (signo === '-' ? -1 : 1) * (Number(horas) * 60 + Number(minutos));
};

// El selector del portal envía la hora sin zona: se entiende como hora local de la aplicación. Devuelve null si no es válida.
const aInstante = (texto) => {
  const partes = FECHA_HORA_REGEX.exec(texto);
  if (!partes) return null;
  const [, anio, mes, dia, hora, minuto, segundo = '0', zona] = partes;
  const valores = [anio, mes, dia, hora, minuto, segundo].map(Number);

  const comoUtc = Date.UTC(valores[0], valores[1] - 1, valores[2], valores[3], valores[4], valores[5]);
  const fecha = new Date(comoUtc);
  // Descarta fechas que no existen, como el 31 de febrero o las 25:00.
  if (
    fecha.getUTCFullYear() !== valores[0] || fecha.getUTCMonth() !== valores[1] - 1 || fecha.getUTCDate() !== valores[2] ||
    fecha.getUTCHours() !== valores[3] || fecha.getUTCMinutes() !== valores[4]
  ) {
    return null;
  }

  if (zona) {
    const instante = new Date(texto.replace(' ', 'T'));
    return Number.isNaN(instante.getTime()) ? null : instante;
  }
  return new Date(comoUtc - desfaseMinutos(fecha) * 60000);
};

module.exports = { hoy, aInstante };
