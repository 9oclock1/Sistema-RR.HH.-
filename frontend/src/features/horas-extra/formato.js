import { Ban, CircleCheck, Hourglass, Minus, SlidersHorizontal } from "lucide-react";

export { formatearFechaHora, formatearHora, formatearJornada, formatearMinutos } from "../justificaciones/formato";

const ZONA_BOLIVIA = "America/La_Paz";
const fechaLarga = new Intl.DateTimeFormat("es-BO", {
  timeZone: "UTC",
  day: "numeric",
  month: "long",
  year: "numeric",
});

// Fecha de hoy en Bolivia como AAAA-MM-DD.
export const hoyBolivia = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_BOLIVIA }).format(new Date());
export const formatearFechaLarga = (fecha) => fechaLarga.format(new Date(`${fecha}T00:00:00Z`));

export const ESTADOS_HORAS = {
  SIN_EXTRA: { tono: "neutral", icono: Minus, texto: "Sin extra" },
  PENDIENTE: { tono: "info", icono: Hourglass, texto: "Por revisar" },
  APROBADA: { tono: "exito", icono: CircleCheck, texto: "Aprobada" },
  AJUSTADA: { tono: "aviso", icono: SlidersHorizontal, texto: "Ajustada" },
  RECHAZADA: { tono: "peligro", icono: Ban, texto: "Rechazada" },
};
