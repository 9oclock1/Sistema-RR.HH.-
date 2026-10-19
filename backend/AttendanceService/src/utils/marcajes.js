const { ErrorApp } = require("./errores");
const { horaBolivia } = require("./jornada");
const { horarioProgramado, ventanaEntrada } = require("./novedades");
const { sumarDias } = require("./periodos");

const TIPO_MARCAJE = { ENTRADA: 1, SALIDA: 2 };
const ORIGEN_MARCAJE = { PORTAL: 1, BIOMETRICO: 2 };
const ESTADO_MARCAJE = { REGISTRADO: 1, PENDIENTE_JUSTIFICACION: 2 };

const HORA_MS = 60 * 60 * 1000;
// Una entrada del día anterior sigue abierta hasta este límite (turnos que cruzan la medianoche).
const HORAS_JORNADA_ABIERTA = 16;
// Sin entrada abierta, una salida más reciente que esto se considera ya registrada.
const HORAS_SALIDA_RECIENTE = 8;

const esEntrada = (marcaje) => marcaje.tipo_codigo === "ENTRADA";
const esSalida = (marcaje) => marcaje.tipo_codigo === "SALIDA";

function jornadaDe(marcajes, fecha) {
  const propios = marcajes.filter((marcaje) => marcaje.fecha_jornada === fecha);
  return {
    fecha_jornada: fecha,
    entrada: propios.find(esEntrada) ?? null,
    salida: propios.find(esSalida) ?? null,
  };
}

// La jornada de la última entrada si sigue abierta (turnos que cruzan la medianoche); si no, la de hoy.
function jornadaEnCurso(marcajes, { hoy, ahora }) {
  const ultima = marcajes.findLast(esEntrada);
  if (ultima && ahora - ultima.fecha_hora_marcaje < HORAS_JORNADA_ABIERTA * HORA_MS) {
    const jornada = jornadaDe(marcajes, ultima.fecha_jornada);
    if (!jornada.salida) return jornada;
  }
  return jornadaDe(marcajes, hoy);
}

// Jornada a la que corresponde una entrada: la del turno programado (de ayer, hoy o mañana) cuya ventana
// de entrada incluye el instante. Así, quien llega pasada la medianoche a un turno nocturno marca en la jornada
// del turno y no ocupa la del día siguiente. Sin turno en la ventana devuelve null.
function fechaJornadaEntrada(programacion, marcajes, { hoy, ahoraMs }) {
  const fechas = new Set([sumarDias(hoy, -1), hoy, sumarDias(hoy, 1)]);
  const candidatos = programacion
    .filter((turno) => !turno.descanso && fechas.has(turno.fecha))
    .map((turno) => ({ fecha: turno.fecha, horario: horarioProgramado(turno, turno.fecha) }))
    .filter(({ horario }) => {
      const { desdeMs, hastaMs } = ventanaEntrada(horario);
      return ahoraMs >= desdeMs && ahoraMs < hastaMs;
    })
    .map((c) => ({ ...c, jornada: jornadaDe(marcajes, c.fecha), distancia: Math.abs(ahoraMs - c.horario.inicioMs) }))
    .sort((a, b) => a.distancia - b.distancia);
  if (candidatos.length === 0) return null;
  // Un turno con la entrada abierta todavía está en curso: una segunda entrada es un duplicado.
  const abierto = candidatos.find((c) => c.jornada.entrada && !c.jornada.salida);
  const libre = candidatos.find((c) => !c.jornada.entrada && !c.jornada.salida);
  return (abierto ?? libre ?? candidatos[0]).fecha;
}

// Salida que impide marcar otra: la de la jornada en curso o, sin entrada abierta, una reciente.
function salidaRegistrada(jornada, marcajes, ahora) {
  if (jornada.salida) return jornada.salida;
  if (jornada.entrada) return null;
  const esReciente = (marcaje) => ahora - marcaje.fecha_hora_marcaje < HORAS_SALIDA_RECIENTE * HORA_MS;
  return marcajes.findLast((marcaje) => esSalida(marcaje) && esReciente(marcaje)) ?? null;
}

function verificarEmpleadoActivo(empleado) {
  if (!empleado) {
    throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  }
  if (empleado.activo !== true) {
    throw new ErrorApp(403, "El empleado no está activo, por lo que no puede registrar marcajes.");
  }
  return empleado;
}

const aLas = (marcaje) => (marcaje ? ` a las ${horaBolivia(marcaje.fecha_hora_marcaje)}` : "");

const entradaDuplicada = (marcaje) => new ErrorApp(409, `Ya registró su entrada de hoy${aLas(marcaje)}.`);

const salidaDuplicada = (marcaje) => new ErrorApp(409, `Ya registró su salida de hoy${aLas(marcaje)}.`);

const jornadaCerrada = (salida) =>
  new ErrorApp(409, `La jornada ya está cerrada: registró su salida a las ${horaBolivia(salida.fecha_hora_marcaje)}.`);

const describirInconsistencia = (salida) =>
  salida?.estado_codigo === "PENDIENTE_JUSTIFICACION"
    ? "No tiene entrada registrada en la jornada. La salida quedó pendiente de justificación."
    : null;

module.exports = {
  TIPO_MARCAJE,
  ORIGEN_MARCAJE,
  ESTADO_MARCAJE,
  esEntrada,
  esSalida,
  jornadaDe,
  jornadaEnCurso,
  fechaJornadaEntrada,
  salidaRegistrada,
  verificarEmpleadoActivo,
  entradaDuplicada,
  salidaDuplicada,
  jornadaCerrada,
  describirInconsistencia,
};
