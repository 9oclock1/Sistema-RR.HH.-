import { formatearValor, hoyLaPaz } from "../conceptos/formato";

export const TIPOS_CONDICION = {
  TRASNOCHE: {
    etiqueta: "Trasnoche",
    tono: "morado",
    ayuda: "Se detecta en las jornadas marcadas con horas entre las 20:00 y las 06:00.",
  },
  FERIADO: {
    etiqueta: "Feriado trabajado",
    tono: "aviso",
    ayuda: "Se detecta en las jornadas marcadas en feriados nacionales.",
  },
  ASIGNACION: {
    etiqueta: "Por asignación",
    tono: "info",
    ayuda: "Se asigna a cada colaborador con fechas, por ejemplo en áreas de congelados.",
  },
};

export const FORMAS_CONDICION = {
  MONTO_FIJO: "Monto fijo",
  PORCENTAJE: "Porcentaje del haber básico",
};

export const esDetectada = (tipo) => tipo === "TRASNOCHE" || tipo === "FERIADO";

export function describirValor(valor, forma, tipo) {
  const texto = formatearValor(valor, forma);
  if (forma === "PORCENTAJE") return `${texto} del haber ${esDetectada(tipo) ? "diario por jornada" : "básico al mes"}`;
  return `${texto} ${esDetectada(tipo) ? "por jornada" : "al mes"}`;
}

export function etiquetaValor(forma, tipo) {
  if (forma === "PORCENTAJE") {
    return esDetectada(tipo) ? "Porcentaje del haber diario por jornada (%)" : "Porcentaje del haber básico mensual (%)";
  }
  return esDetectada(tipo) ? "Monto por jornada (Bs)" : "Monto mensual (Bs)";
}

export function formatearMinutos(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${resto} min` : `${horas} h`;
}

export const mesActual = () => hoyLaPaz().slice(0, 7);

export const formatearMes = (periodo) => {
  const texto = new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${periodo}-01T00:00:00Z`)
  );
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export const formatearMomento = (iso) =>
  new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" }).format(
    new Date(iso)
  );

// "05/10" para listas de jornadas del mismo mes.
export const formatearDia = (fecha) => fecha.slice(5).split("-").reverse().join("/");
