const enUTC = (fecha) => new Date(`${fecha}T00:00:00Z`);

const diaSemanaCorto = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "short" });
const diaLargo = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const diaMes = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", day: "numeric", month: "long" });
const mesAnio = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", month: "long", year: "numeric" });
const fechaHora = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
});

const sinPunto = (texto) => texto.replace(".", "");

export const formatearDiaCorto = (fecha) => sinPunto(diaSemanaCorto.format(enUTC(fecha)));

export const numeroDia = (fecha) => Number(fecha.slice(8, 10));

export const formatearDiaLargo = (fecha) => diaLargo.format(enUTC(fecha));

export const formatearFechaHora = (valor) => fechaHora.format(new Date(valor));

export const esFinDeSemana = (fecha) => [0, 6].includes(enUTC(fecha).getUTCDay());

export function describirPeriodo({ periodo, fecha_inicio, fecha_fin }) {
  if (periodo.codigo === "MENSUAL") return mesAnio.format(enUTC(fecha_inicio));
  return `Del ${diaMes.format(enUTC(fecha_inicio))} al ${diaMes.format(enUTC(fecha_fin))}`;
}

export const hoyEnBolivia = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());

export const horario = (turno) => `${turno.hora_inicio.slice(0, 5)}–${turno.hora_fin.slice(0, 5)}`;

// Abreviatura única por turno (iniciales); "D" queda para el descanso.
export function abreviar(turnos) {
  const usadas = new Set(["D"]);
  const resultado = new Map();
  for (const turno of turnos) {
    const palabras = turno.nombre.trim().split(/\s+/);
    const candidatas = [
      palabras.map((p) => p[0]).join("").slice(0, 2),
      turno.nombre.trim().slice(0, 2),
      turno.nombre.trim().slice(0, 3),
    ].map((texto) => texto.toLocaleUpperCase("es"));
    let abreviatura = candidatas.find((c) => !usadas.has(c));
    for (let n = 2; !abreviatura; n += 1) {
      if (!usadas.has(`${candidatas[0]}${n}`)) abreviatura = `${candidatas[0]}${n}`;
    }
    usadas.add(abreviatura);
    resultado.set(turno.id_turno, abreviatura);
  }
  return resultado;
}

const FRANJA = { DIURNO: "manana", VESPERTINO: "tarde", NOCTURNO: "noche" };

export const franjaDe = (turno) => FRANJA[turno?.tipo_codigo] ?? "manana";
