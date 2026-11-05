import { CircleCheck, CircleX, Hourglass, PencilLine } from "lucide-react";
import { plural } from "../solicitud-vacaciones/formato";

const ZONA_BOLIVIA = "America/La_Paz";
const DIA_MS = 24 * 60 * 60 * 1000;

export const DIAS_PLAZO_CORTO = 3;

const fechaBolivia = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_BOLIVIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const numeroPuntaje = new Intl.NumberFormat("es-BO", {
  maximumFractionDigits: 2,
});

export const hoyEnBolivia = (ahora = new Date()) => fechaBolivia.format(ahora);

export const formatearPuntaje = (valor) => numeroPuntaje.format(valor);

export const ESTADOS_EVALUACION = {
  PENDIENTE: { tono: "info", icono: Hourglass, texto: "Pendiente" },
  BORRADOR: { tono: "aviso", icono: PencilLine, texto: "Borrador" },
  ENVIADA: { tono: "exito", icono: CircleCheck, texto: "Enviada" },
  VENCIDA: { tono: "peligro", icono: CircleX, texto: "Vencida" },
};

export const ACCIONES_EVALUACION = {
  PENDIENTE: { texto: "Responder", principal: true },
  BORRADOR: { texto: "Continuar", principal: true },
  ENVIADA: { texto: "Ver", principal: false },
  VENCIDA: { texto: "Ver", principal: false },
};

export const TIPOS_COMPETENCIA = {
  COMPETENCIA_LABORAL: "Competencia laboral",
  FACTOR_OPERATIVO: "Factor operativo",
};

export const idCampoPregunta = (idPregunta) => `ev-pregunta-${idPregunta}`;

// Evaluaciones que todavía se pueden responder.
export const esAbierta = (evaluacion) =>
  evaluacion.estado_codigo === "PENDIENTE" ||
  evaluacion.estado_codigo === "BORRADOR";

export function describirPlazo(fechaLimite, hoy = hoyEnBolivia()) {
  const dias = Math.round(
    (Date.parse(`${fechaLimite}T00:00:00Z`) - Date.parse(`${hoy}T00:00:00Z`)) /
      DIA_MS,
  );
  if (dias < 0)
    return {
      texto: `Venció hace ${plural(-dias, "día", "días")}`,
      tono: "vencido",
    };
  if (dias === 0) return { texto: "Vence hoy", tono: "corto" };
  if (dias === 1) return { texto: "Vence mañana", tono: "corto" };
  return {
    texto: `Vence en ${dias} días`,
    tono: dias <= DIAS_PLAZO_CORTO ? "corto" : "normal",
  };
}

export function describirAvance({
  estado_codigo: estado,
  puntaje_final: puntaje,
  progreso,
}) {
  if (estado === "ENVIADA") return `Puntaje ${formatearPuntaje(puntaje)}`;
  if (progreso.respondidas === 0) return "Sin respuestas";
  if (progreso.obligatorias_total === 0)
    return `${progreso.respondidas} de ${progreso.total} preguntas`;
  return `${progreso.obligatorias_respondidas} de ${progreso.obligatorias_total} obligatorias`;
}
