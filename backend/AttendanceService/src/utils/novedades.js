const { minutosDuracion, minutosEfectivos, inicioProgramadoMs } = require("./jornada");

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

module.exports = {
  TIPO_NOVEDAD,
  ESTADO_NOVEDAD,
  ESTADO_JORNADA,
  horarioProgramado,
  contrastarJornada,
  estadoJornada,
};
