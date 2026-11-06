const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const esFecha = (valor) =>
  typeof valor === "string" &&
  FECHA_RE.test(valor) &&
  !isNaN(Date.parse(`${valor}T00:00:00Z`)) &&
  new Date(`${valor}T00:00:00Z`).toISOString().startsWith(valor);

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

module.exports = { esFecha, hoyLaPaz, esPrimerDiaDeMes, sumarMeses };
