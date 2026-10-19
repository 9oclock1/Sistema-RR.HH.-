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

export function formatearDuracion(minutos) {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return horas ? `${horas} h ${String(resto).padStart(2, "0")} min` : `${resto} min`;
}

export const duracionISO = (minutos) => `PT${Math.floor(minutos / 60)}H${minutos % 60}M`;

export const describirOrigen = ({ origen_codigo, codigo_dispositivo }) =>
  origen_codigo === "BIOMETRICO" ? `Lector biométrico ${codigo_dispositivo}` : "Portal";

const minutos = (n) => (n === 1 ? "1 minuto" : `${n} minutos`);

export const describirAtraso = ({ minutos: n, turno }) =>
  `Llegó ${minutos(n)} tarde: su turno ${turno.nombre} empieza a las ${formatearHora(turno.inicio_programado)}` +
  (turno.minutos_tolerancia ? ` (tolerancia de ${minutos(turno.minutos_tolerancia)}).` : ".");

export const describirSalidaAnticipada = ({ minutos: n, turno }) =>
  `Salió ${formatearDuracion(n)} antes del fin de su turno (${formatearHora(turno.fin_programado)}). Ese tiempo queda como no trabajado.`;
