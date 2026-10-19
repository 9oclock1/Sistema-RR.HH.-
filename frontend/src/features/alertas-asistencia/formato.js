const ZONA_BOLIVIA = "America/La_Paz";

const hora = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_BOLIVIA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const fechaLarga = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });

export const hoyEnBolivia = () => new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_BOLIVIA }).format(new Date());

export const formatearHora = (valor) => hora.format(new Date(valor));

export const formatearFecha = (fecha) => fechaLarga.format(new Date(`${fecha}T00:00:00Z`));

export function formatearMinutos(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (!horas) return `${resto} min`;
  return resto ? `${horas} h ${String(resto).padStart(2, "0")} min` : `${horas} h`;
}
