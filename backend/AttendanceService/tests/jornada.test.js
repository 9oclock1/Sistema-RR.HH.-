const { test } = require("node:test");
const assert = require("node:assert/strict");
const { minutosDuracion, minutosEfectivos, evaluarPuntualidad, minutosTrabajados } = require("../src/utils/jornada");

const diurno = { hora_inicio: "08:00:00", hora_fin: "16:00:00", minutos_refrigerio: 60, minutos_tolerancia: 5 };
const nocturno = { hora_inicio: "22:00:00", hora_fin: "06:00:00", minutos_refrigerio: 30, minutos_tolerancia: 10 };

const marcar = (turno, fechaJornada, fechaHora) => evaluarPuntualidad(turno, fechaJornada, new Date(fechaHora));

test("descuenta el refrigerio de las horas efectivas", () => {
  assert.equal(minutosDuracion(diurno), 480);
  assert.equal(minutosEfectivos(diurno), 420);
});

test("turno nocturno cruza la medianoche", () => {
  assert.equal(minutosDuracion(nocturno), 480);
  assert.equal(minutosEfectivos(nocturno), 450);
});

test("marcaje antes del inicio es puntual", () => {
  assert.deepEqual(
    marcar(diurno, "2026-09-23", "2026-09-23T07:50:00-04:00"),
    {
      puntual: true,
      minutos_atraso: 0,
      inicio_programado: "2026-09-23T12:00:00.000Z",
      limite_puntualidad: "2026-09-23T12:05:00.000Z",
    }
  );
});

test("marcaje dentro de la tolerancia es puntual", () => {
  assert.equal(marcar(diurno, "2026-09-23", "2026-09-23T08:04:00-04:00").puntual, true);
});

test("el límite de tolerancia es inclusivo", () => {
  assert.equal(marcar(diurno, "2026-09-23", "2026-09-23T08:05:00-04:00").puntual, true);
});

test("marcaje fuera de la tolerancia es atraso desde la hora de inicio", () => {
  const resultado = marcar(diurno, "2026-09-23", "2026-09-23T08:05:30-04:00");
  assert.equal(resultado.puntual, false);
  assert.equal(resultado.minutos_atraso, 6);
});

test("sin tolerancia, un segundo tarde es atraso", () => {
  const resultado = marcar({ ...diurno, minutos_tolerancia: 0 }, "2026-09-23", "2026-09-23T08:00:01-04:00");
  assert.equal(resultado.puntual, false);
  assert.equal(resultado.minutos_atraso, 1);
});

test("marcaje en UTC se evalúa en hora de Bolivia", () => {
  assert.equal(marcar(diurno, "2026-09-23", "2026-09-23T12:04:00Z").puntual, true);
  assert.equal(marcar(diurno, "2026-09-23", "2026-09-23T12:06:00Z").puntual, false);
});

test("turno nocturno: la jornada es la del día de inicio", () => {
  assert.equal(marcar(nocturno, "2026-09-23", "2026-09-23T22:10:00-04:00").puntual, true);
  const tarde = marcar(nocturno, "2026-09-23", "2026-09-24T00:05:00-04:00");
  assert.equal(tarde.puntual, false);
  assert.equal(tarde.minutos_atraso, 125);
});

const marca = (fechaHora) => ({ fecha_hora_marcaje: new Date(fechaHora) });

test("horas trabajadas en minutos completos, como las horas mostradas", () => {
  assert.equal(minutosTrabajados(marca("2026-09-24T08:03:40-04:00"), marca("2026-09-24T17:10:10-04:00")), 547);
});

test("horas trabajadas de un turno que cruza la medianoche", () => {
  assert.equal(minutosTrabajados(marca("2026-09-23T22:00:00-04:00"), marca("2026-09-24T06:00:59-04:00")), 480);
});

test("sin entrada o sin salida no hay horas trabajadas", () => {
  assert.equal(minutosTrabajados(null, marca("2026-09-24T17:10:00-04:00")), null);
  assert.equal(minutosTrabajados(marca("2026-09-24T08:00:00-04:00"), null), null);
});
