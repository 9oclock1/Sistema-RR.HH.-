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

module.exports = { esFecha, sumarDias, diaAnterior, hoyLaPaz };
