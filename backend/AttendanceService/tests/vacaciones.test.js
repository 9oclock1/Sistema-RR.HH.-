const { test } = require("node:test");
const assert = require("node:assert/strict");
const { diasPorAnio, aniversario, periodosAcreditados, calcularSaldo, fechaBolivia } = require("../src/utils/vacaciones");

const GOZADO = 2;
const EN_PROCESO = 1;

test("escala legal: 0, 15, 20 y 30 días según los años cumplidos", () => {
  assert.deepEqual([0, 1, 4, 5, 9, 10, 25].map(diasPorAnio), [0, 15, 15, 20, 20, 30, 30]);
});

test("antigüedad menor a un año: no gana días", () => {
  const resultado = calcularSaldo("2026-03-15", "2027-03-14", []);
  assert.equal(resultado.anios_servicio, 0);
  assert.equal(resultado.dias_anuales, 0);
  assert.deepEqual(resultado.saldo, { acumulados: 0, gozados: 0, en_proceso: 0, disponibles: 0 });
  assert.deepEqual(resultado.proximo_periodo, { fecha_acreditacion: "2027-03-15", dias: 15 });
});

test("el día exacto del aniversario acredita el período", () => {
  assert.equal(calcularSaldo("2026-03-15", "2027-03-15", []).saldo.acumulados, 15);
});

test("antigüedad intermedia: acumula 15 días por año", () => {
  const resultado = calcularSaldo("2023-01-10", "2026-10-18", []);
  assert.equal(resultado.anios_servicio, 3);
  assert.equal(resultado.saldo.acumulados, 45);
  assert.deepEqual(resultado.periodos.map((p) => p.fecha_acreditacion), ["2024-01-10", "2025-01-10", "2026-01-10"]);
});

test("escalamiento: al cumplir 5 años el período pasa a 20 días y al cumplir 10, a 30", () => {
  const cinco = calcularSaldo("2021-06-01", "2026-06-01", []);
  assert.deepEqual(cinco.periodos.map((p) => p.dias), [15, 15, 15, 15, 20]);
  assert.equal(cinco.saldo.acumulados, 80);
  assert.equal(cinco.dias_anuales, 20);

  const diez = calcularSaldo("2016-06-01", "2026-06-01", []);
  assert.equal(diez.periodos[9].dias, 30);
  assert.equal(diez.saldo.acumulados, 4 * 15 + 5 * 20 + 30);
  assert.equal(diez.dias_anuales, 30);
});

test("el saldo descuenta días gozados y en proceso; los cancelados no cuentan", () => {
  const movimientos = [
    { id_estado_movimiento: GOZADO, dias: 10 },
    { id_estado_movimiento: EN_PROCESO, dias: 5 },
    { id_estado_movimiento: 3, dias: 7 },
  ];
  assert.deepEqual(calcularSaldo("2023-01-10", "2026-10-18", movimientos).saldo, {
    acumulados: 45,
    gozados: 10,
    en_proceso: 5,
    disponibles: 30,
  });
});

test("ingreso el 29 de febrero: el aniversario en año no bisiesto es el 28", () => {
  assert.equal(aniversario("2024-02-29", 1), "2025-02-28");
  assert.equal(aniversario("2024-02-29", 4), "2028-02-29");
});

test("fecha de ingreso futura: sin períodos", () => {
  assert.deepEqual(periodosAcreditados("2027-01-01", "2026-10-18"), []);
});

test("la fecha de hoy es la de Bolivia (UTC-4)", () => {
  assert.equal(fechaBolivia(new Date("2026-10-19T02:00:00Z")), "2026-10-18");
  assert.equal(fechaBolivia(new Date("2026-10-18T04:00:00Z")), "2026-10-18");
});
