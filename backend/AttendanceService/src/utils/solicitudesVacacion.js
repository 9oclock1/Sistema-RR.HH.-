const { ErrorApp } = require("./errores");
// Los días ganados y la escala legal viven en KAN-52: aquí solo se arma el saldo para la solicitud.
const { aniversario, calcularSaldo: calcularSaldoLegal } = require("./vacaciones");

const ESTADO_SOLICITUD = { PENDIENTE: 1, APROBADA: 2, RECHAZADA: 3, CANCELADA: 4 };
// Estados que ocupan fechas y descuentan saldo.
const ESTADOS_EN_CURSO = [ESTADO_SOLICITUD.PENDIENTE, ESTADO_SOLICITUD.APROBADA];

// Días calendario que deben pasar entre el envío de la solicitud y el inicio de las vacaciones.
const DIAS_ANTICIPACION_MINIMA = 7;
// Límite del rango consultable, para no recorrer periodos absurdos.
const DIAS_CALENDARIO_MAXIMOS = 90;

const DIA_MS = 24 * 60 * 60 * 1000;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const aFecha = (texto) => new Date(`${texto}T00:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

const esFechaValida = (texto) => typeof texto === "string" && FECHA_RE.test(texto) && aTexto(aFecha(texto)) === texto;

function sumarDias(texto, dias) {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aTexto(fecha);
}

const diasEntre = (desde, hasta) => Math.round((aFecha(hasta) - aFecha(desde)) / DIA_MS);

// Sábado y domingo son descansos obligatorios.
const esFinDeSemana = (texto) => [0, 6].includes(aFecha(texto).getUTCDay());

// Días hábiles del rango (inclusive), sin descansos ni feriados.
// Un día con turno publicado es hábil si es de trabajo y descanso si es de descanso; sin turno publicado,
// se descansan el sábado y el domingo.
function contarDiasHabiles(fechaInicio, fechaFin, feriados = [], turnos = []) {
  const fechasFeriado = new Set(feriados.map((feriado) => feriado.fecha));
  const descansoPublicado = new Map(turnos.map((turno) => [turno.fecha, turno.es_descanso]));
  const feriadosExcluidos = [];
  let diasHabiles = 0;
  let diasDescanso = 0;

  for (let dia = fechaInicio; dia <= fechaFin; dia = sumarDias(dia, 1)) {
    if (descansoPublicado.has(dia) ? descansoPublicado.get(dia) : esFinDeSemana(dia)) diasDescanso++;
    else if (fechasFeriado.has(dia)) feriadosExcluidos.push(feriados.find((feriado) => feriado.fecha === dia));
    else diasHabiles++;
  }

  return {
    dias_calendario: diasEntre(fechaInicio, fechaFin) + 1,
    dias_habiles: diasHabiles,
    dias_descanso: diasDescanso,
    feriados: feriadosExcluidos,
  };
}

// Saldo para la solicitud: los días ganados, gozados y en proceso salen del cálculo de KAN-52.
function calcularSaldo({ fechaIngreso, hoy, movimientos }) {
  const { anios_servicio, saldo } = calcularSaldoLegal(fechaIngreso, hoy, movimientos);
  return {
    fecha_ingreso: fechaIngreso,
    anios_servicio,
    dias_ganados: saldo.acumulados,
    dias_comprometidos: saldo.gozados + saldo.en_proceso,
    dias_disponibles: Math.max(0, saldo.disponibles),
    habilitado: anios_servicio >= 1,
    habilitado_desde: anios_servicio >= 1 ? null : aniversario(fechaIngreso, 1),
    fecha_minima_inicio: sumarDias(hoy, DIAS_ANTICIPACION_MINIMA),
  };
}

function validarFechas({ fecha_inicio, fecha_fin } = {}) {
  const errores = [];
  if (!esFechaValida(fecha_inicio)) errores.push({ campo: "fecha_inicio", mensaje: "Ingrese una fecha de inicio válida." });
  if (!esFechaValida(fecha_fin)) errores.push({ campo: "fecha_fin", mensaje: "Ingrese una fecha de conclusión válida." });
  if (errores.length === 0 && fecha_fin < fecha_inicio) {
    errores.push({ campo: "fecha_fin", mensaje: "La fecha de conclusión no puede ser anterior a la de inicio." });
  }
  if (errores.length === 0 && diasEntre(fecha_inicio, fecha_fin) + 1 > DIAS_CALENDARIO_MAXIMOS) {
    errores.push({ campo: "fecha_fin", mensaje: `El periodo no puede superar ${DIAS_CALENDARIO_MAXIMOS} días calendario.` });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Fechas de vacaciones inválidas", errores);
  return { fechaInicio: fecha_inicio, fechaFin: fecha_fin };
}

function verificarAntiguedad(saldo) {
  if (!saldo.habilitado) {
    throw new ErrorApp(
      403,
      `Aún no cumple un año de antigüedad. Podrá solicitar vacaciones desde el ${formatearFecha(saldo.habilitado_desde)}.`
    );
  }
}

const formatearFecha = (texto) => texto.split("-").reverse().join("/");

// Problemas que impiden enviar la solicitud. Cada uno lleva un código para que el portal muestre la alerta adecuada.
function buscarProblemas({ fechaInicio, calculo, saldo, solapadas }) {
  const problemas = [];
  if (fechaInicio < saldo.fecha_minima_inicio) {
    problemas.push({
      codigo: "ANTICIPACION_INSUFICIENTE",
      campo: "fecha_inicio",
      mensaje: `Debe solicitar con al menos ${DIAS_ANTICIPACION_MINIMA} días de anticipación: la fecha de inicio más próxima es el ${formatearFecha(saldo.fecha_minima_inicio)}.`,
    });
  }
  if (calculo.dias_habiles === 0) {
    problemas.push({
      codigo: "SIN_DIAS_HABILES",
      campo: "fecha_fin",
      mensaje: "El periodo seleccionado no tiene días hábiles: solo incluye fines de semana o feriados.",
    });
  } else if (calculo.dias_habiles > saldo.dias_disponibles) {
    problemas.push({
      codigo: "SALDO_INSUFICIENTE",
      campo: "fecha_fin",
      mensaje: `Saldo insuficiente: solicita ${calculo.dias_habiles} días hábiles y tiene ${saldo.dias_disponibles} disponibles.`,
    });
  }
  for (const otra of solapadas) {
    problemas.push({
      codigo: "CONFLICTO_FECHAS",
      campo: "fecha_inicio",
      mensaje: `Las fechas se cruzan con su solicitud ${otra.estado_nombre.toLowerCase()} del ${formatearFecha(otra.fecha_inicio)} al ${formatearFecha(otra.fecha_fin)}.`,
    });
  }
  return problemas;
}

module.exports = {
  ESTADO_SOLICITUD,
  ESTADOS_EN_CURSO,
  DIAS_ANTICIPACION_MINIMA,
  DIAS_CALENDARIO_MAXIMOS,
  contarDiasHabiles,
  calcularSaldo,
  validarFechas,
  verificarAntiguedad,
  buscarProblemas,
};
