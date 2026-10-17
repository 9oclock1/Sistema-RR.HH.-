const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  ESTADO_HORAS_EXTRA,
  minutosNocturnos,
  minutosMinimosExtra,
  segregarJornada,
  tramosAprobados,
  liquidarJornada,
  estadoInicial,
  calculoDesdeFila,
} = require("../src/utils/horasExtra");

const bo = (fechaHora) => new Date(`${fechaHora}:00-04:00`);
const min = (fechaHora) => Math.floor(bo(fechaHora).getTime() / 60000);
const turno = (fecha, inicio, fechaFin, fin, refrigerio = 0) => ({
  inicioProgramado: bo(`${fecha}T${inicio}`),
  finProgramado: bo(`${fechaFin}T${fin}`),
  minutosRefrigerio: refrigerio,
});
const jornada = (entrada, salida, programado = {}) => ({ entrada: bo(entrada), salida: bo(salida), ...programado });

test("franja nocturna: de 20:00 a 06:00 de Bolivia", () => {
  assert.equal(minutosNocturnos(min("2026-10-05T19:00"), min("2026-10-05T21:00")), 60);
  assert.equal(minutosNocturnos(min("2026-10-06T05:00"), min("2026-10-06T07:00")), 60);
  assert.equal(minutosNocturnos(min("2026-10-05T22:00"), min("2026-10-06T06:00")), 480);
  assert.equal(minutosNocturnos(min("2026-10-05T08:00"), min("2026-10-05T19:59")), 0);
  assert.equal(minutosNocturnos(min("2026-10-05T00:00"), min("2026-10-06T00:00")), 600);
  assert.equal(minutosNocturnos(min("2026-10-05T10:00"), min("2026-10-05T09:00")), 0);
});

test("turno diurno con salida tardía: el tiempo después del fin es extra", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T18:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  assert.equal(calculo.minutos_trabajados, 600);
  assert.equal(calculo.minutos_ordinarios, 420);
  assert.equal(calculo.minutos_ordinarios_nocturnos, 0);
  assert.equal(calculo.minutos_extra, 120);
  assert.equal(calculo.minutos_anticipados, 0);
});

test("el tiempo antes del inicio queda aparte como anticipado", () => {
  const calculo = segregarJornada(jornada("2026-10-05T07:00", "2026-10-05T16:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  assert.equal(calculo.minutos_ordinarios, 420);
  assert.equal(calculo.minutos_extra, 0);
  assert.equal(calculo.minutos_anticipados, 60);
});

test("sin turno programado todo lo trabajado es extra", () => {
  const calculo = segregarJornada(jornada("2026-10-05T09:00", "2026-10-05T13:30"));
  assert.equal(calculo.minutos_ordinarios, 0);
  assert.equal(calculo.minutos_extra, 270);
});

test("por debajo del mínimo, el tiempo fuera del turno no cuenta como extra", () => {
  const programado = turno("2026-10-05", "08:00", "2026-10-05", "16:00");
  assert.equal(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T16:14", programado), 15).minutos_extra, 0);
  assert.equal(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T16:15", programado), 15).minutos_extra, 15);
});

test("mínimo de minutos extra configurable, 15 por defecto", () => {
  const anterior = process.env.MINUTOS_MINIMOS_EXTRA;
  delete process.env.MINUTOS_MINIMOS_EXTRA;
  assert.equal(minutosMinimosExtra(), 15);
  process.env.MINUTOS_MINIMOS_EXTRA = "0";
  assert.equal(minutosMinimosExtra(), 0);
  process.env.MINUTOS_MINIMOS_EXTRA = "abc";
  assert.equal(minutosMinimosExtra(), 15);
  if (anterior === undefined) delete process.env.MINUTOS_MINIMOS_EXTRA;
  else process.env.MINUTOS_MINIMOS_EXTRA = anterior;
});

test("hasta 2 horas extra por día son simples y el resto dobles", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T19:30", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  const pago = liquidarJornada(calculo, { aprobados: 210 });
  assert.equal(pago.minutos_extra_simples, 120);
  assert.equal(pago.minutos_extra_dobles, 90);
  assert.equal(pago.minutos_feriado, 0);
});

test("sin aprobación no se paga ninguna hora extra", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T19:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00")));
  assert.deepEqual(liquidarJornada(calculo), {
    minutos_extra_pagables: 0,
    minutos_extra_simples: 0,
    minutos_extra_dobles: 0,
    minutos_extra_nocturnos: 0,
    minutos_feriado: 0,
    minutos_nocturnos: 0,
  });
});

test("en feriado lo trabajado y las extra aprobadas se pagan dobles", () => {
  const calculo = segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T17:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00", 60)));
  const pago = liquidarJornada(calculo, { aprobados: 60, esFeriado: true });
  assert.equal(pago.minutos_extra_simples, 0);
  assert.equal(pago.minutos_feriado, 420);
  assert.equal(pago.minutos_extra_dobles, 480);
});

test("lo aprobado se toma primero después del turno y luego del tiempo anticipado", () => {
  const calculo = segregarJornada(jornada("2026-10-05T07:00", "2026-10-05T17:00", turno("2026-10-05", "08:00", "2026-10-05", "16:00")));
  assert.deepEqual(tramosAprobados(calculo, 90), [
    [min("2026-10-05T16:00"), min("2026-10-05T17:00")],
    [min("2026-10-05T07:30"), min("2026-10-05T08:00")],
  ]);
  assert.equal(liquidarJornada(calculo, { aprobados: 500 }).minutos_extra_pagables, 120);
});

test("estado inicial: sin tiempo fuera del turno no hay nada que revisar", () => {
  const programado = turno("2026-10-05", "08:00", "2026-10-05", "16:00");
  assert.equal(estadoInicial(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T16:00", programado))).idEstado, ESTADO_HORAS_EXTRA.SIN_EXTRA);
  assert.equal(estadoInicial(segregarJornada(jornada("2026-10-05T08:00", "2026-10-05T17:00", programado))).idEstado, ESTADO_HORAS_EXTRA.PENDIENTE);
});

test("los tramos guardados se rehacen igual que al calcular", () => {
  const programado = turno("2026-10-05", "22:00", "2026-10-06", "06:00", 30);
  const calculo = segregarJornada(jornada("2026-10-05T21:00", "2026-10-06T08:00", programado));
  const fila = {
    entrada_en: bo("2026-10-05T21:00"),
    salida_en: bo("2026-10-06T08:00"),
    inicio_programado: programado.inicioProgramado,
    fin_programado: programado.finProgramado,
    ...calculo,
  };
  const rehecho = calculoDesdeFila(fila);
  assert.deepEqual(rehecho.tramos_extra, calculo.tramos_extra);
  assert.deepEqual(rehecho.tramo_anticipado, calculo.tramo_anticipado);
});
