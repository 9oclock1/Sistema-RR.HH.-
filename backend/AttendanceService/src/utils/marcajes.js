const { ErrorApp } = require("./errores");
const { horaBolivia } = require("./jornada");

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

function diaAnterior(fecha) {
  const dia = new Date(`${fecha}T00:00:00Z`);
  dia.setUTCDate(dia.getUTCDate() - 1);
  return dia.toISOString().slice(0, 10);
}

function jornadaDe(marcajes, fecha) {
  const propios = marcajes.filter((marcaje) => marcaje.fecha_jornada === fecha);
  return {
    fecha_jornada: fecha,
    entrada: propios.find(esEntrada) ?? null,
    salida: propios.find(esSalida) ?? null,
  };
}

// La jornada de hoy, salvo que la del día anterior siga abierta.
function jornadaEnCurso(marcajes, { hoy, ahora }) {
  const actual = jornadaDe(marcajes, hoy);
  if (actual.entrada || actual.salida) return actual;

  const anterior = jornadaDe(marcajes, diaAnterior(hoy));
  const sigueAbierta =
    anterior.entrada && !anterior.salida && ahora - anterior.entrada.fecha_hora_marcaje < HORAS_JORNADA_ABIERTA * HORA_MS;
  return sigueAbierta ? anterior : actual;
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
  jornadaEnCurso,
  salidaRegistrada,
  verificarEmpleadoActivo,
  entradaDuplicada,
  salidaDuplicada,
  jornadaCerrada,
  describirInconsistencia,
};
