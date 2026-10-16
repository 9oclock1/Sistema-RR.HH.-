const { minutosDuracion, minutosEfectivos, inicioProgramadoMs } = require("./jornada");
const { TIPO_EVENTO } = require("./eventos");

const TIPO_NOVEDAD = { ATRASO: 1, INASISTENCIA: 2, SALIDA_ANTICIPADA: 3, OMISION_SALIDA: 4 };
const ESTADO_NOVEDAD = { REGISTRADA: 1, JUSTIFICADA: 2 };

const ESTADO_JORNADA = {
  SIN_TURNO: "Sin turno",
  DESCANSO: "Descanso",
  POR_LLEGAR: "Por llegar",
  SIN_MARCAR: "Sin marcar",
  INASISTENCIA: "Falta injustificada",
  ATRASO: "Atraso",
  PUNTUAL: "Puntual",
};

const MINUTO_MS = 60 * 1000;
// Una entrada cuenta para el turno si se marca desde 4 horas antes de su inicio.
const ANTICIPACION_ENTRADA_MS = 4 * 60 * MINUTO_MS;

const instante = (marcaje) => new Date(marcaje.fecha_hora_marcaje).getTime();

// Minutos iniciados entre dos instantes: un segundo de diferencia ya cuenta como un minuto.
const minutosEntre = (desdeMs, hastaMs) => Math.ceil((hastaMs - desdeMs) / MINUTO_MS);

function horarioProgramado(turno, fecha) {
  const inicioMs = inicioProgramadoMs(turno, fecha);
  return {
    inicioMs,
    limiteMs: inicioMs + turno.minutos_tolerancia * MINUTO_MS,
    finMs: inicioMs + minutosDuracion(turno) * MINUTO_MS,
  };
}

// La entrada del turno es la primera marcada en su ventana; la salida, la de la misma jornada de marcaje.
function marcajesDelTurno(horario, marcajes) {
  const entrada =
    marcajes.find(
      (m) =>
        m.tipo_codigo === "ENTRADA" &&
        instante(m) >= horario.inicioMs - ANTICIPACION_ENTRADA_MS &&
        instante(m) < horario.finMs
    ) ?? null;
  const salida = entrada
    ? (marcajes.find(
        (m) => m.tipo_codigo === "SALIDA" && m.fecha_jornada === entrada.fecha_jornada && instante(m) >= instante(entrada)
      ) ?? null)
    : null;
  return { entrada, salida };
}

const novedad = (tipo, minutos, idMarcaje = null) => ({
  tipo,
  minutos,
  // La omisión de salida queda como alerta: no descuenta tiempo.
  minutos_penalizacion: tipo === "OMISION_SALIDA" ? 0 : minutos,
  id_marcaje: idMarcaje,
});

// Contrasta el turno de un día con los marcajes del empleado (ordenados por hora) en el instante `ahoraMs`.
// La jornada se cierra `minutosCierre` después del fin del turno; ahí se detecta la falta de salida.
function contrastarJornada({ turno, fecha, marcajes, ahoraMs, minutosCierre, registrarFaltas = true }) {
  if (!turno || turno.descanso) return { horario: null, entrada: null, salida: null, novedades: [], cerrada: false };

  const horario = horarioProgramado(turno, fecha);
  const { entrada, salida } = marcajesDelTurno(horario, marcajes);
  const cerrada = ahoraMs >= horario.finMs + minutosCierre * MINUTO_MS;
  const novedades = [];

  if (entrada) {
    if (instante(entrada) > horario.limiteMs) {
      novedades.push(novedad("ATRASO", minutosEntre(horario.inicioMs, instante(entrada)), entrada.id_marcaje));
    }
    if (salida && instante(salida) < horario.finMs) {
      novedades.push(novedad("SALIDA_ANTICIPADA", minutosEntre(instante(salida), horario.finMs), salida.id_marcaje));
    }
    if (!salida && cerrada) novedades.push(novedad("OMISION_SALIDA", 0, entrada.id_marcaje));
  } else if (registrarFaltas && ahoraMs >= horario.finMs) {
    novedades.push(novedad("INASISTENCIA", minutosEfectivos(turno)));
  }

  return { horario, entrada, salida, novedades, cerrada };
}

// Estado del colaborador en el panel del supervisor.
function estadoJornada(turno, resultado, ahoraMs) {
  let codigo;
  if (!turno) codigo = "SIN_TURNO";
  else if (turno.descanso) codigo = "DESCANSO";
  else if (resultado.entrada) codigo = resultado.novedades.some((n) => n.tipo === "ATRASO") ? "ATRASO" : "PUNTUAL";
  else if (ahoraMs >= resultado.horario.finMs) codigo = "INASISTENCIA";
  else if (ahoraMs > resultado.horario.limiteMs) codigo = "SIN_MARCAR";
  else codigo = "POR_LLEGAR";
  return { codigo, nombre: ESTADO_JORNADA[codigo] };
}

// Filas de NOVEDADES_ASISTENCIA con la copia del turno programado.
const filasNovedades = (turno, resultado) =>
  resultado.novedades.map((n) => ({
    id_empleado: turno.id_empleado,
    fecha_jornada: turno.fecha,
    id_tipo_novedad: TIPO_NOVEDAD[n.tipo],
    id_turno: turno.id_turno,
    id_rol: turno.id_rol ?? null,
    nombre_turno: turno.nombre_turno,
    inicio_programado: new Date(resultado.horario.inicioMs),
    fin_programado: new Date(resultado.horario.finMs),
    minutos_tolerancia: turno.minutos_tolerancia,
    id_marcaje: n.id_marcaje,
    minutos: n.minutos,
    minutos_penalizacion: n.minutos_penalizacion,
    minutos_programados: minutosEfectivos(turno),
  }));

// Agrupa novedades (ordenadas por empleado y jornada) en una lista por jornada.
function agruparPorJornada(novedades) {
  const grupos = new Map();
  for (const n of novedades) {
    const clave = `${n.id_empleado}|${n.fecha_jornada}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(n);
  }
  return [...grupos.values()];
}

// Horas efectivas de la jornada: las del turno menos la penalización de las novedades no justificadas.
function totalesJornada(novedades) {
  const suma = (estado) =>
    novedades.filter((n) => n.estado_codigo === estado).reduce((total, n) => total + n.minutos_penalizacion, 0);
  const programados = Math.max(0, ...novedades.map((n) => n.minutos_programados ?? 0));
  const penalizacion = suma("REGISTRADA");
  return {
    minutos_programados: programados,
    minutos_penalizacion: penalizacion,
    minutos_justificados: suma("JUSTIFICADA"),
    minutos_efectivos: Math.max(0, programados - penalizacion),
  };
}

// Cuerpo del evento para compensaciones: las novedades de una jornada, la penalización que suman y las horas efectivas.
function armarCargaConsolidacion(novedades, evento = TIPO_EVENTO.JORNADA_CONSOLIDADA) {
  const [primera] = novedades;
  return {
    evento,
    id_empleado: primera.id_empleado,
    fecha_jornada: primera.fecha_jornada,
    turno: {
      nombre: primera.nombre_turno,
      inicio_programado: new Date(primera.inicio_programado).toISOString(),
      fin_programado: new Date(primera.fin_programado).toISOString(),
    },
    ...totalesJornada(novedades),
    novedades: novedades.map((n) => ({
      id_novedad: n.id_novedad,
      tipo: n.tipo_codigo,
      estado: n.estado_codigo,
      minutos: n.minutos,
      minutos_penalizacion: n.minutos_penalizacion,
    })),
  };
}

module.exports = {
  TIPO_NOVEDAD,
  ESTADO_NOVEDAD,
  ESTADO_JORNADA,
  horarioProgramado,
  contrastarJornada,
  estadoJornada,
  filasNovedades,
  agruparPorJornada,
  totalesJornada,
  armarCargaConsolidacion,
};
