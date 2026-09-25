const ZONA_BOLIVIA = "America/La_Paz";

const hora = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_BOLIVIA,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const horaConSegundos = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_BOLIVIA,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

const fechaLarga = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", dateStyle: "full" });

export const formatearHora = (fecha) => hora.format(new Date(fecha));

export const formatearHoraConSegundos = (fecha) => horaConSegundos.format(fecha);

export const formatearFechaJornada = (fechaJornada) => fechaLarga.format(new Date(`${fechaJornada}T00:00:00Z`));
