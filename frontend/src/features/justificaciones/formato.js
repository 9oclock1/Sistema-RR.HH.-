import { CircleCheck, CircleX, Hourglass } from "lucide-react";

const ZONA_BOLIVIA = "America/La_Paz";

const fechaHora = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_BOLIVIA,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const hora = new Intl.DateTimeFormat("es-BO", { timeZone: ZONA_BOLIVIA, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fechaCorta = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });

export const formatearFechaHora = (valor) => fechaHora.format(new Date(valor));
export const formatearHora = (valor) => hora.format(new Date(valor));
export const formatearJornada = (fecha) => fechaCorta.format(new Date(`${fecha}T00:00:00Z`));

export function formatearMinutos(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export function formatearTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

// Qué ocurrió, en una frase corta para listas y tablas.
export function describirNovedad({ tipo, minutos }) {
  if (tipo.codigo === "ATRASO") return `${formatearMinutos(minutos)} de atraso`;
  if (tipo.codigo === "SALIDA_ANTICIPADA") return `Salió ${formatearMinutos(minutos)} antes`;
  if (tipo.codigo === "INASISTENCIA") return `${formatearMinutos(minutos)} no trabajadas`;
  return tipo.nombre;
}

export const ESTADOS_SOLICITUD = {
  PENDIENTE: { tono: "info", icono: Hourglass, texto: "Pendiente de revisión" },
  APROBADA: { tono: "exito", icono: CircleCheck, texto: "Aprobada" },
  RECHAZADA: { tono: "peligro", icono: CircleX, texto: "Rechazada" },
};

// Tiempo que falta para el vencimiento: «quedan 5 h 20 min».
export function tiempoRestante(venceEn, ahora = Date.now()) {
  const minutos = Math.floor((new Date(venceEn).getTime() - ahora) / 60000);
  if (minutos <= 0) return null;
  if (minutos >= 48 * 60) return `quedan ${Math.floor(minutos / (24 * 60))} días`;
  return `quedan ${formatearMinutos(minutos)}`;
}
