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
