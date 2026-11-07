import { CalendarDays, FileText } from "lucide-react";

export const CATEGORIAS = {
  VACACIONES: { texto: "Vacaciones", icono: CalendarDays },
  LICENCIA: { texto: "Licencia o permiso", icono: FileText },
};

export const PRIORIDADES = {
  ALTA: { tono: "peligro", texto: "Alta", ayuda: "Empieza en 7 días o menos, ya empezó o necesita a RRHH." },
  MEDIA: { tono: "aviso", texto: "Media", ayuda: "Empieza dentro de los próximos 30 días." },
  BAJA: { tono: "neutral", texto: "Baja", ayuda: "Empieza en más de 30 días." },
};

export const IMPACTO = {
  BAJO: { tono: "exito", texto: "Impacto bajo" },
  MEDIO: { tono: "aviso", texto: "Impacto medio" },
  ALTO: { tono: "peligro", texto: "Impacto alto" },
  SIN_DATOS: { tono: "neutral", texto: "Sin datos del equipo" },
};

export const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;

// Vacaciones se cuentan en días hábiles; las licencias, en días corridos.
export const describirDias = (dias, tipo) =>
  tipo === "habiles" ? plural(dias, "día hábil", "días hábiles") : plural(dias, "día corrido", "días corridos");
