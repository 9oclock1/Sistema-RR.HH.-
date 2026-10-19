import { Ban, CircleCheck, Hourglass, Minus, SlidersHorizontal } from "lucide-react";
import { formatearMinutos } from "../justificaciones/formato";

export { formatearFechaHora, formatearHora, formatearJornada, formatearMinutos } from "../justificaciones/formato";

// Ley General del Trabajo: jornada de 8 horas (art. 46) y hasta 2 horas extra por día (art. 50).
export const MINUTOS_JORNADA_DIA = 480;
export const MINUTOS_EXTRA_DIA = 120;
export const MAXIMO_MINUTOS_AUTORIZABLES = MINUTOS_JORNADA_DIA + MINUTOS_EXTRA_DIA;

// Minutos a pagar de una jornada (o de un total), como los separa el servicio para planillas.
const PARTES_PAGO = [
  ["minutos_extra_habil", "extra"],
  ["minutos_domingo", "en domingo"],
  ["minutos_extra_domingo", "extra en domingo"],
  ["minutos_feriado", "en feriado"],
  ["minutos_extra_feriado", "extra en feriado"],
  ["minutos_descanso", "en día de descanso"],
];

export const partesPago = (pago) =>
  PARTES_PAGO.filter(([campo]) => pago?.[campo] > 0).map(
    ([campo, texto]) => `${formatearMinutos(pago[campo])} ${texto}`
  );

export const totalPago = (pago) => PARTES_PAGO.reduce((total, [campo]) => total + (pago?.[campo] ?? 0), 0);

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
