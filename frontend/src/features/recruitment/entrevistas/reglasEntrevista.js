// RF-15: reglas de la agenda de entrevistas que la vista necesita antes de llamar al backend (que vuelve a validarlas).

// Las citas se agendan en hora de La Paz, la misma zona con la que el backend interpreta la hora elegida.
export const ZONA_HORARIA = "America/La_Paz";

export const CODIGOS_AGENDABLES = ["ENTREVISTA_TECNICA", "APTO"];
export const ESTADOS_ACTIVOS = ["PROGRAMADA", "REPROGRAMADA"];
export const MAX_LUGAR = 255;
export const MAX_MOTIVO = 1000;

export const MODALIDAD = { PRESENCIAL: "PRESENCIAL", VIRTUAL: "VIRTUAL" };

export const DURACIONES = [
  { valor: "30", etiqueta: "30 minutos" },
  { valor: "45", etiqueta: "45 minutos" },
  { valor: "60", etiqueta: "1 hora" },
  { valor: "90", etiqueta: "1 hora 30 minutos" },
  { valor: "120", etiqueta: "2 horas" },
];
export const DURACION_PREDETERMINADA = "60";

// Horario laboral en tramos de 15 minutos (07:00 a 20:45).
export const HORAS = Array.from({ length: 56 }, (_, i) => {
  const minutos = 7 * 60 + i * 15;
  const hora = `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
  return { valor: hora, etiqueta: hora };
});

const TONOS_ESTADO = { PROGRAMADA: "info", REPROGRAMADA: "morado", CANCELADA: "neutral", REALIZADA: "exito" };
export const tonoEstado = (codigo) => TONOS_ESTADO[codigo] ?? "neutral";

export const AVISO = {
  ENTREGADO: { tono: "exito", texto: "Correo enviado" },
  PENDIENTE: { tono: "aviso", texto: "Correo en cola" },
  FALLIDO: { tono: "peligro", texto: "Correo no enviado" },
};

export const esAgendable = (postulacion) =>
  !postulacion.esta_archivada && CODIGOS_AGENDABLES.includes(postulacion.codigo_etapa);

export const estaActiva = (entrevista) => ESTADOS_ACTIVOS.includes(entrevista.codigo_estado);

const formatoPartes = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_HORARIA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

// { fecha: 'AAAA-MM-DD', hora: 'HH:mm' } de un instante, en hora de La Paz.
export function partesLocales(valor) {
  const partes = Object.fromEntries(formatoPartes.formatToParts(new Date(valor)).map((p) => [p.type, p.value]));
  return { fecha: `${partes.year}-${partes.month}-${partes.day}`, hora: `${partes.hour}:${partes.minute}` };
}

export const hoyLocal = () => partesLocales(Date.now()).fecha;

// 'AAAA-MM-DD' + n días, sin depender de la zona del navegador.
export function sumarDias(fecha, dias) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

const formatoDia = new Intl.DateTimeFormat("es-BO", {
  timeZone: ZONA_HORARIA,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export const formatearDia = (valor) => formatoDia.format(new Date(valor));

// «lun, 15 mar 2030 · 10:00–10:45»
export function formatearCita(entrevista) {
  const inicio = partesLocales(entrevista.fecha_hora_programada).hora;
  const fin = entrevista.fecha_hora_fin
    ? partesLocales(entrevista.fecha_hora_fin).hora
    : partesLocales(new Date(entrevista.fecha_hora_programada).getTime() + entrevista.duracion_minutos * 60000).hora;
  return `${formatearDia(entrevista.fecha_hora_programada)} · ${inicio}–${fin}`;
}

// Minutos desde la medianoche de 'HH:mm'.
const aMinutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

// Citas activas del día que se cruzan con [hora, hora + duración). Las del evaluador vienen de la agenda del backend.
export function citasQueSeCruzan(agendaDelDia, { fecha, hora, duracion, excluirId }) {
  if (!fecha || !hora || !duracion) return [];
  const inicio = aMinutos(hora);
  const fin = inicio + Number(duracion);
  return agendaDelDia.filter((cita) => {
    if (cita.id_entrevista === excluirId || !estaActiva(cita)) return false;
    const desde = partesLocales(cita.fecha_hora_programada);
    if (desde.fecha !== fecha) return false;
    const otroInicio = aMinutos(desde.hora);
    return otroInicio < fin && otroInicio + cita.duracion_minutos > inicio;
  });
}

export function esUrlValida(texto) {
  try {
    const url = new URL(texto);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export const nombreCandidato = (entrevista) => `${entrevista.nombres} ${entrevista.apellidos}`.trim();

// ---- Calendario semanal (RF-15.5) ----

export const HORA_INICIO_CALENDARIO = 7;
export const HORA_FIN_CALENDARIO = 21;

// Lunes de la semana de 'AAAA-MM-DD'.
export function lunesDe(fecha) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
  return sumarDias(fecha, diaSemana === 0 ? -6 : 1 - diaSemana);
}

export const diasDeSemana = (lunes) => Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));

const formatoCabecera = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "short", day: "numeric" });
const formatoMes = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", month: "long", year: "numeric" });
const formatoDiaLargo = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" });
const aFechaUtc = (fecha) => new Date(`${fecha}T12:00:00Z`);

export const cabeceraDia = (fecha) => formatoCabecera.format(aFechaUtc(fecha));
export const diaLargo = (fecha) => formatoDiaLargo.format(aFechaUtc(fecha));

// «20 – 26 de octubre de 2026» o, si la semana cruza de mes, «27 oct – 2 nov 2026».
export function tituloSemana(lunes) {
  const domingo = sumarDias(lunes, 6);
  const [, mesInicio, diaInicio] = lunes.split("-").map(Number);
  const [, mesFin, diaFin] = domingo.split("-").map(Number);
  if (mesInicio === mesFin) return `${diaInicio} – ${diaFin} de ${formatoMes.format(aFechaUtc(domingo))}`;
  const corto = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", day: "numeric", month: "short" });
  return `${corto.format(aFechaUtc(lunes))} – ${corto.format(aFechaUtc(domingo))} ${domingo.slice(0, 4)}`;
}

/**
 * Agrupa las citas por día ('AAAA-MM-DD' en La Paz) y, dentro de cada día, les asigna un carril para que las que se
 * cruzan se muestren lado a lado: { carril, carriles } con carriles = cuántas comparten el grupo de cruces.
 */
export function distribuirPorDia(citas) {
  const porDia = new Map();
  for (const cita of citas) {
    const { fecha, hora } = partesLocales(cita.fecha_hora_programada);
    const inicio = aMinutos(hora);
    const item = { cita, inicio, fin: inicio + cita.duracion_minutos };
    if (!porDia.has(fecha)) porDia.set(fecha, []);
    porDia.get(fecha).push(item);
  }

  for (const items of porDia.values()) {
    items.sort((a, b) => a.inicio - b.inicio || b.fin - a.fin);
    let grupo = [];
    let finGrupo = -1;
    const cerrarGrupo = () => grupo.forEach((item) => (item.carriles = Math.max(...grupo.map((g) => g.carril)) + 1));
    for (const item of items) {
      if (item.inicio >= finGrupo) {
        cerrarGrupo();
        grupo = [];
      }
      const ocupados = new Set(grupo.filter((g) => g.fin > item.inicio).map((g) => g.carril));
      let carril = 0;
      while (ocupados.has(carril)) carril++;
      item.carril = carril;
      grupo.push(item);
      finGrupo = Math.max(finGrupo, item.fin);
    }
    cerrarGrupo();
  }
  return porDia;
}
