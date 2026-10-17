const ESTADO_HORAS_EXTRA = { SIN_EXTRA: 1, PENDIENTE: 2, APROBADA: 3, AJUSTADA: 4, RECHAZADA: 5 };

const MINUTOS_DIA = 24 * 60;
// Bolivia: UTC-4 sin horario de verano.
const DESFASE_MINUTOS = 4 * 60;
// Franja nocturna legal: de 20:00 a 06:00.
const INICIO_NOCHE = 20 * 60;
const DURACION_NOCHE = 10 * 60;
// Ley General del Trabajo: hasta 2 horas extra por día; lo que pase de ahí se paga como extra doble.
const MINUTOS_EXTRA_SIMPLES_DIA = 120;

const aMinutos = (valor) => Math.floor(new Date(valor).getTime() / 60000);
const largo = ([desde, hasta]) => Math.max(0, hasta - desde);

// Minutos del tramo [desde, hasta) dentro de la franja de 20:00 a 06:00 de Bolivia.
function minutosNocturnos(desde, hasta) {
  if (hasta <= desde) return 0;
  const primerDia = Math.floor((desde - DESFASE_MINUTOS) / MINUTOS_DIA) - 1;
  const ultimoDia = Math.floor((hasta - DESFASE_MINUTOS) / MINUTOS_DIA);
  let total = 0;
  for (let dia = primerDia; dia <= ultimoDia; dia++) {
    const inicio = dia * MINUTOS_DIA + INICIO_NOCHE + DESFASE_MINUTOS;
    total += largo([Math.max(desde, inicio), Math.min(hasta, inicio + DURACION_NOCHE)]);
  }
  return total;
}

// Minutos por debajo de los cuales el tiempo fuera del turno no se cuenta como extra (por defecto 15).
function minutosMinimosExtra() {
  const valor = Number(process.env.MINUTOS_MINIMOS_EXTRA);
  return Number.isInteger(valor) && valor >= 0 ? valor : 15;
}

const tramoValido = (tramo, minimo) => (largo(tramo) > 0 && largo(tramo) >= minimo ? tramo : null);

// Separa la jornada marcada en tiempo ordinario (dentro del turno, menos el refrigerio), horas extra después
// del fin del turno y tiempo anticipado antes del inicio, que solo cuenta si se autoriza.
// Sin turno programado (descanso o día libre), todo el tiempo trabajado es extra.
// Todo en minutos completos, como se muestran las horas al empleado.
function segregarJornada({ entrada, salida, inicioProgramado = null, finProgramado = null, minutosRefrigerio = 0 }, minimo = 0) {
  const e = aMinutos(entrada);
  const s = aMinutos(salida);
  const trabajados = Math.max(0, s - e);

  if (inicioProgramado == null || finProgramado == null) {
    const extra = tramoValido([e, s], minimo);
    return {
      minutos_trabajados: trabajados,
      minutos_ordinarios: 0,
      minutos_ordinarios_nocturnos: 0,
      minutos_extra: extra ? largo(extra) : 0,
      minutos_anticipados: 0,
      tramos_extra: extra ? [extra] : [],
      tramo_anticipado: null,
    };
  }

  const inicio = aMinutos(inicioProgramado);
  const fin = aMinutos(finProgramado);
  const ordinario = [Math.max(e, inicio), Math.min(s, fin)];
  const enTurno = largo(ordinario);
  const nocturnoEnTurno = minutosNocturnos(...ordinario);
  // El refrigerio se descuenta primero del tiempo diurno: el nocturno se paga con recargo.
  const refrigerio = Math.min(minutosRefrigerio, enTurno);
  const refrigerioNocturno = Math.max(0, refrigerio - (enTurno - nocturnoEnTurno));
  const despues = tramoValido([Math.max(e, fin), s], minimo);
  const antes = tramoValido([e, Math.min(s, inicio)], minimo);

  return {
    minutos_trabajados: trabajados,
    minutos_ordinarios: enTurno - refrigerio,
    minutos_ordinarios_nocturnos: nocturnoEnTurno - refrigerioNocturno,
    minutos_extra: despues ? largo(despues) : 0,
    minutos_anticipados: antes ? largo(antes) : 0,
    tramos_extra: despues ? [despues] : [],
    tramo_anticipado: antes,
  };
}

// Tramos que cubren los minutos aprobados: primero el tiempo después del turno y luego el anticipado,
// contando hacia atrás desde el inicio del turno.
function tramosAprobados({ tramos_extra, tramo_anticipado }, aprobados) {
  const tramos = [];
  let resto = aprobados;
  for (const [desde, hasta] of tramos_extra) {
    const tomar = Math.min(resto, hasta - desde);
    if (tomar > 0) tramos.push([desde, desde + tomar]);
    resto -= tomar;
  }
  if (resto > 0 && tramo_anticipado) {
    const [desde, hasta] = tramo_anticipado;
    tramos.push([Math.max(desde, hasta - resto), hasta]);
  }
  return tramos;
}

const maximoAprobable = (calculo) => calculo.minutos_extra + calculo.minutos_anticipados;

// Lo que se paga de la jornada: horas extra simples (hasta 2 por día), dobles (el resto, o todas en feriado)
// y minutos nocturnos (ordinarios más los extra aprobados dentro de la franja). En feriado, el tiempo ordinario
// trabajado también se paga doble.
function liquidarJornada(calculo, { aprobados = 0, esFeriado = false } = {}) {
  const pagables = Math.min(Math.max(0, aprobados), maximoAprobable(calculo));
  const extraNocturnos = tramosAprobados(calculo, pagables).reduce((total, tramo) => total + minutosNocturnos(...tramo), 0);
  const simples = esFeriado ? 0 : Math.min(pagables, MINUTOS_EXTRA_SIMPLES_DIA);
  const feriado = esFeriado ? calculo.minutos_ordinarios : 0;
  return {
    minutos_extra_pagables: pagables,
    minutos_extra_simples: simples,
    minutos_extra_dobles: pagables - simples + feriado,
    minutos_extra_nocturnos: extraNocturnos,
    minutos_feriado: feriado,
    minutos_nocturnos: calculo.minutos_ordinarios_nocturnos + extraNocturnos,
  };
}

// Estado inicial de la jornada calculada: con tiempo fuera del turno queda pendiente de revisión.
const estadoInicial = (calculo) =>
  maximoAprobable(calculo) === 0
    ? { idEstado: ESTADO_HORAS_EXTRA.SIN_EXTRA, aprobados: null }
    : { idEstado: ESTADO_HORAS_EXTRA.PENDIENTE, aprobados: null };

// Rehace los tramos a partir de lo guardado en HORAS_JORNADA, sin depender del mínimo configurado hoy.
function calculoDesdeFila(fila) {
  const e = aMinutos(fila.entrada_en);
  const s = aMinutos(fila.salida_en);
  const conTurno = fila.inicio_programado != null;
  const desdeExtra = conTurno ? Math.max(e, aMinutos(fila.fin_programado)) : e;
  const hastaAnticipado = conTurno ? Math.min(s, aMinutos(fila.inicio_programado)) : null;
  return {
    minutos_ordinarios: fila.minutos_ordinarios,
    minutos_ordinarios_nocturnos: fila.minutos_ordinarios_nocturnos,
    minutos_extra: fila.minutos_extra,
    minutos_anticipados: fila.minutos_anticipados,
    tramos_extra: fila.minutos_extra > 0 ? [[desdeExtra, desdeExtra + fila.minutos_extra]] : [],
    tramo_anticipado: fila.minutos_anticipados > 0 ? [hastaAnticipado - fila.minutos_anticipados, hastaAnticipado] : null,
  };
}

module.exports = {
  ESTADO_HORAS_EXTRA,
  MINUTOS_EXTRA_SIMPLES_DIA,
  minutosNocturnos,
  minutosMinimosExtra,
  segregarJornada,
  tramosAprobados,
  maximoAprobable,
  liquidarJornada,
  estadoInicial,
  calculoDesdeFila,
};
