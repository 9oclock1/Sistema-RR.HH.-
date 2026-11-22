const { test } = require("node:test");
const assert = require("node:assert/strict");
const { CODIGOS_PARAMETRO, resolverParametros, calcularRetencion, resumirRetenciones, porcentajeDe } = require("../src/utils/tributario");

const filasParametros = (salarioMinimo) => [
  { codigo: CODIGOS_PARAMETRO.SALARIO_MINIMO, valor: String(salarioMinimo) },
  { codigo: CODIGOS_PARAMETRO.MULTIPLO, valor: "2" },
  { codigo: CODIGOS_PARAMETRO.ALICUOTA_RCIVA, valor: "13" },
  { codigo: CODIGOS_PARAMETRO.ALICUOTA_CREDITO, valor: "13" },
];

const vigentes = resolverParametros(filasParametros(2750));
const anteriores = resolverParametros(filasParametros(2500));

test("el mínimo no imponible es el múltiplo del salario mínimo vigente", () => {
  assert.equal(vigentes.minimoNoImponible, 5500);
  assert.equal(anteriores.minimoNoImponible, 5000);
  assert.deepEqual(vigentes.faltantes, []);
});

test("resolverParametros acepta numéricos como texto y avisa de los faltantes", () => {
  assert.equal(vigentes.alicuotaRciva, 13);
  const incompletos = resolverParametros(filasParametros(2750).slice(0, 2));
  assert.deepEqual(incompletos.faltantes, [CODIGOS_PARAMETRO.ALICUOTA_RCIVA, CODIGOS_PARAMETRO.ALICUOTA_CREDITO]);
});

test("un sueldo neto bajo el mínimo no imponible no genera impuesto", () => {
  const r = calcularRetencion({ totalGanado: 4000, aportesLaborales: 508.4 }, vigentes);
  assert.equal(r.sueldo_neto, 3491.6);
  assert.equal(r.base_imponible, 0);
  assert.equal(r.impuesto_determinado, 0);
  assert.equal(r.impuesto_retenido, 0);
});

test("un sueldo neto igual al mínimo no imponible tampoco paga", () => {
  const r = calcularRetencion({ totalGanado: 5500, aportesLaborales: 0 }, vigentes);
  assert.equal(r.base_imponible, 0);
  assert.equal(r.impuesto_retenido, 0);
});

test("sin créditos, se retiene todo el impuesto sobre el excedente", () => {
  const r = calcularRetencion({ totalGanado: 10000, aportesLaborales: 1271 }, vigentes);
  assert.equal(r.sueldo_neto, 8729);
  assert.equal(r.base_imponible, 3229);
  assert.equal(r.impuesto_determinado, 419.77);
  assert.equal(r.credito_aplicado, 0);
  assert.equal(r.impuesto_retenido, 419.77);
  assert.equal(r.saldo_favor_siguiente, 0);
});

test("las facturas declaradas generan crédito del 13 % y reducen la retención", () => {
  const r = calcularRetencion({ totalGanado: 10000, aportesLaborales: 1271, montoFacturas: 2000 }, vigentes);
  assert.equal(r.credito_fiscal_facturas, 260);
  assert.equal(r.credito_aplicado, 260);
  assert.equal(r.impuesto_retenido, 159.77);
  assert.equal(r.saldo_favor_siguiente, 0);
});

test("el crédito que sobra pasa como saldo a favor del mes siguiente", () => {
  const r = calcularRetencion({ totalGanado: 10000, aportesLaborales: 1271, montoFacturas: 5000 }, vigentes);
  assert.equal(r.credito_fiscal_facturas, 650);
  assert.equal(r.credito_aplicado, 419.77);
  assert.equal(r.impuesto_retenido, 0);
  assert.equal(r.saldo_favor_siguiente, 230.23);
});

test("el saldo a favor anterior se suma al crédito disponible", () => {
  const r = calcularRetencion({ totalGanado: 10000, aportesLaborales: 1271, montoFacturas: 5000, saldoAnterior: 100 }, vigentes);
  assert.equal(r.saldo_anterior_favor, 100);
  assert.equal(r.credito_aplicado, 419.77);
  assert.equal(r.saldo_favor_siguiente, 330.23);
});

test("sin impuesto, el crédito completo se conserva como saldo", () => {
  const r = calcularRetencion({ totalGanado: 3000, aportesLaborales: 300, montoFacturas: 1000, saldoAnterior: 20 }, vigentes);
  assert.equal(r.impuesto_determinado, 0);
  assert.equal(r.credito_aplicado, 0);
  assert.equal(r.saldo_favor_siguiente, 150);
});

test("el cambio de salario mínimo cambia el impuesto del mismo sueldo", () => {
  const entrada = { totalGanado: 10000, aportesLaborales: 1271 };
  assert.equal(calcularRetencion(entrada, vigentes).impuesto_determinado, 419.77);
  assert.equal(calcularRetencion(entrada, anteriores).base_imponible, 3729);
  assert.equal(calcularRetencion(entrada, anteriores).impuesto_determinado, 484.77);
});

test("los aportes mayores al ganado no producen sueldo neto negativo", () => {
  const r = calcularRetencion({ totalGanado: 100, aportesLaborales: 500 }, vigentes);
  assert.equal(r.sueldo_neto, 0);
  assert.equal(r.impuesto_retenido, 0);
});

test("porcentajeDe redondea en centavos hacia arriba desde la mitad", () => {
  assert.equal(porcentajeDe(3, 13), 0);
  assert.equal(porcentajeDe(4, 13), 1);
  assert.equal(porcentajeDe(5, 13), 1);
  assert.equal(porcentajeDe(322900, 13), 41977);
});

test("un cambio de la alícuota se refleja en el impuesto", () => {
  const otra = resolverParametros([
    ...filasParametros(2750).filter((f) => f.codigo !== CODIGOS_PARAMETRO.ALICUOTA_RCIVA),
    { codigo: CODIGOS_PARAMETRO.ALICUOTA_RCIVA, valor: "10" },
  ]);
  const r = calcularRetencion({ totalGanado: 10000, aportesLaborales: 1271 }, otra);
  assert.equal(r.impuesto_determinado, 322.9);
});

test("resumirRetenciones suma los totales y cuenta quienes retienen", () => {
  const filas = [
    calcularRetencion({ totalGanado: 4000, aportesLaborales: 508.4 }, vigentes),
    calcularRetencion({ totalGanado: 10000, aportesLaborales: 1271, montoFacturas: 2000 }, vigentes),
    calcularRetencion({ totalGanado: 10000, aportesLaborales: 1271, montoFacturas: 5000 }, vigentes),
  ];
  const totales = resumirRetenciones(filas);
  assert.equal(totales.cantidad_dependientes, 3);
  assert.equal(totales.dependientes_con_retencion, 1);
  assert.equal(totales.total_impuesto_determinado, 839.54);
  assert.equal(totales.total_credito_aplicado, 679.77);
  assert.equal(totales.total_impuesto_retenido, 159.77);
});
