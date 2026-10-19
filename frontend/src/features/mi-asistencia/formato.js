import { ESTADOS_SOLICITUD } from "../justificaciones/formato";

// Formatos de «Mi asistencia» (RF-28).
const ZONA_BOLIVIA = "America/La_Paz";

const horaExacta = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_BOLIVIA,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const fechaHora = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_BOLIVIA,
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const fechaDia = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "short", day: "2-digit", month: "short" });
const fechaLarga = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", dateStyle: "full" });

const aFecha = (texto) => new Date(`${texto}T00:00:00Z`);

export const formatearHoraExacta = (valor) => horaExacta.format(new Date(valor));
export const formatearFechaHora = (valor) => fechaHora.format(new Date(valor));
export const formatearDia = (texto) => fechaDia.format(aFecha(texto));
export const formatearDiaLargo = (texto) => fechaLarga.format(aFecha(texto));
// 'AAAA-MM-DD' → 'DD/MM/AAAA'.
export const fechaCorta = (texto) => texto.split("-").reverse().join("/");

export function formatearMinutos(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export const hoyBolivia = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_BOLIVIA }).format(new Date());

// Por defecto, el mes en curso.
export function filtrosIniciales() {
  const hoy = hoyBolivia();
  return { modo: "mes", mes: hoy.slice(0, 7), desde: `${hoy.slice(0, 8)}01`, hasta: hoy };
}

export const ESTADOS_DIA = {
  LABORADO: { tono: "exito", texto: "Laborado" },
  FALTA: { tono: "peligro", texto: "Falta" },
  LICENCIA: { tono: "morado", texto: "Licencia" },
  DESCANSO: { tono: "neutral", texto: "Descanso" },
  SIN_TURNO: { tono: "neutral", texto: "Sin turno" },
  EN_CURSO: { tono: "info", texto: "En curso" },
  SIN_REGISTRO: { tono: "aviso", texto: "Sin marcajes" },
};

export const TONO_NOVEDAD = { ATRASO: "aviso", SALIDA_ANTICIPADA: "aviso", INASISTENCIA: "peligro", OMISION_SALIDA: "neutral" };

// Pendiente, aprobada o rechazada: mismo tono e ícono para justificativos y licencias.
export const estadoSolicitud = (codigo) => ESTADOS_SOLICITUD[codigo] ?? { tono: "neutral", icono: undefined };

export function describirNovedad({ tipo, minutos }) {
  if (tipo.codigo === "ATRASO") return `Atraso de ${formatearMinutos(minutos)}`;
  if (tipo.codigo === "SALIDA_ANTICIPADA") return `Salida ${formatearMinutos(minutos)} antes`;
  if (tipo.codigo === "INASISTENCIA") return "Falta";
  return tipo.nombre;
}
