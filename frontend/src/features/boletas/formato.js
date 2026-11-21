import { formatearValor } from "../conceptos/formato";
import { formatearBs } from "../planillas/formato";

// Los montos llegan como texto con dos decimales ("3500.00").
export const bs = (valor) => formatearBs(Number(valor));

// "2026-08" → "agosto de 2026".
export const nombreMes = (periodo) =>
  new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${periodo}-01T00:00:00Z`));

export const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

export const fechaHora = (valor) =>
  new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(valor));

// "12,71 % sobre Bs 3.976,67 · 27 de 30 días", igual que el detalle de la planilla.
export function describir(r) {
  const valor = formatearValor(Number(r.valor), r.forma_calculo);
  const base = r.forma_calculo === "PORCENTAJE" && r.base !== null ? `${valor} sobre ${bs(r.base)}` : valor;
  return [base, r.detalle].filter(Boolean).join(" · ");
}

// Mensaje para cada rechazo del servidor al descargar (la respuesta binaria no trae el texto del error).
export function mensajeDescarga(error) {
  if (error.estado === 401) return "Elija su usuario de prueba al pie de la barra lateral.";
  if (error.estado === 403) return "Solo puede consultar sus propias boletas de pago.";
  if (error.estado === 404) return "La boleta ya no está disponible.";
  if (error.estado === 409) return "La boleta no coincide con la planilla cerrada: comuníquese con RRHH.";
  return error.message;
}
