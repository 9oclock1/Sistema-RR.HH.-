const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 24 * 60 * 60 * 1000;

const esFecha = (valor) =>
  typeof valor === "string" &&
  FECHA_RE.test(valor) &&
  !isNaN(Date.parse(`${valor}T00:00:00Z`)) &&
  new Date(`${valor}T00:00:00Z`).toISOString().startsWith(valor);

const sumarDias = (fecha, dias) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * DIA_MS).toISOString().slice(0, 10);

const diaAnterior = (fecha) => sumarDias(fecha, -1);

// Fecha de hoy en Bolivia (UTC-4), en formato AAAA-MM-DD.
const hoyLaPaz = (ahora = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(ahora);

const esPrimerDiaDeMes = (fecha) => esFecha(fecha) && fecha.slice(8, 10) === "01";

// Mismo día 1, `n` meses después. Usamos UTC para no arrastrar el huso horario local del servidor.
const sumarMeses = (fecha, n) => {
  const fechaUtc = new Date(`${fecha}T00:00:00Z`);
  fechaUtc.setUTCMonth(fechaUtc.getUTCMonth() + n);
  return fechaUtc.toISOString().slice(0, 10);
};

// Años completos de servicio a una fecha de referencia (RF-50): cuenta solo los aniversarios ya cumplidos.
function aniosDeServicio(fechaIngreso, referencia) {
  const [anioIngreso, mesIngreso, diaIngreso] = fechaIngreso.split("-").map(Number);
  const [anioRef, mesRef, diaRef] = referencia.split("-").map(Number);
  let anios = anioRef - anioIngreso;
  if (mesRef < mesIngreso || (mesRef === mesIngreso && diaRef < diaIngreso)) anios -= 1;
  return Math.max(anios, 0);
}

module.exports = { esFecha, sumarDias, diaAnterior, hoyLaPaz, esPrimerDiaDeMes, sumarMeses, aniosDeServicio };
