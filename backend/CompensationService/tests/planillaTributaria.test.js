const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  CODIGOS_PARAMETRO,
  resolverParametros,
  calcularRetencion,
  resumirRetenciones,
  porcentajeDe,
  actualizarConUfv,
  periodoAnterior,
  finDePeriodo,
} = require("../src/utils/tributario");

const filasParametros = (salarioMinimo, alicuotaRciva = 13) => [
  { codigo: CODIGOS_PARAMETRO.SALARIO_MINIMO, valor: String(salarioMinimo) },
  { codigo: CODIGOS_PARAMETRO.MULTIPLO, valor: "2" },
  { codigo: CODIGOS_PARAMETRO.ALICUOTA_RCIVA, valor: String(alicuotaRciva) },
  { codigo: CODIGOS_PARAMETRO.ALICUOTA_CREDITO, valor: "13" },
];

const vigentes = resolverParametros(filasParametros(2750));
const anteriores = resolverParametros(filasParametros(2500));
const ALTO = { totalGanado: 15000, aportesLaborales: 1906.5 };

test("el mínimo no imponible es el múltiplo del salario mínimo vigente", () => {
  assert.equal(vigentes.minimoNoImponible, 5500);
  assert.equal(anteriores.minimoNoImponible, 5000);
  assert.deepEqual(vigentes.faltantes, []);
});

test("el cómputo es el 13 % de dos salarios mínimos", () => {
  assert.equal(vigentes.computoSalariosMinimos, 715);
  assert.equal(anteriores.computoSalariosMinimos, 650);
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
  assert.equal(r.computo_salarios_minimos, 0);
  assert.equal(r.impuesto_retenido, 0);
});

test("el cómputo de 2 salarios mínimos cubre el impuesto de un neto de 7.419,65 (caso de Jorge)", () => {
  const r = calcularRetencion({ totalGanado: 8500, aportesLaborales: 1080.35 }, vigentes);
  assert.equal(r.sueldo_neto, 7419.65);
  assert.equal(r.base_imponible, 1919.65);
  assert.equal(r.impuesto_determinado, 249.55);
  assert.equal(r.computo_salarios_minimos, 249.55);
  assert.equal(r.impuesto_retenido, 0);
});

test("en la práctica solo se retiene sobre lo que pasa de 4 salarios mínimos de sueldo neto", () => {
  const justo = calcularRetencion({ totalGanado: 11000, aportesLaborales: 0 }, vigentes);
  assert.equal(justo.impuesto_determinado, 715);
  assert.equal(justo.impuesto_retenido, 0);
  const encima = calcularRetencion({ totalGanado: 11010, aportesLaborales: 0 }, vigentes);
  assert.equal(encima.impuesto_determinado, 716.3);
  assert.equal(encima.computo_salarios_minimos, 715);
  assert.equal(encima.impuesto_retenido, 1.3);
});

test("sin créditos, se retiene el impuesto que queda después del cómputo", () => {
  const r = calcularRetencion(ALTO, vigentes);
  assert.equal(r.sueldo_neto, 13093.5);
  assert.equal(r.base_imponible, 7593.5);
  assert.equal(r.impuesto_determinado, 987.16);
  assert.equal(r.computo_salarios_minimos, 715);
  assert.equal(r.credito_aplicado, 0);
  assert.equal(r.impuesto_retenido, 272.16);
  assert.equal(r.saldo_favor_siguiente, 0);
});

test("las facturas declaradas generan crédito del 13 % y reducen la retención", () => {
  const r = calcularRetencion({ ...ALTO, montoFacturas: 1000 }, vigentes);
  assert.equal(r.credito_fiscal_facturas, 130);
  assert.equal(r.credito_aplicado, 130);
  assert.equal(r.impuesto_retenido, 142.16);
  assert.equal(r.saldo_favor_siguiente, 0);
});

test("el crédito que sobra pasa como saldo a favor del mes siguiente", () => {
  const r = calcularRetencion({ ...ALTO, montoFacturas: 3000 }, vigentes);
  assert.equal(r.credito_fiscal_facturas, 390);
  assert.equal(r.credito_aplicado, 272.16);
  assert.equal(r.impuesto_retenido, 0);
  assert.equal(r.saldo_favor_siguiente, 117.84);
});

test("el cómputo de 2 salarios mínimos no se arrastra como saldo a favor", () => {
  const r = calcularRetencion({ totalGanado: 8500, aportesLaborales: 1080.35, montoFacturas: 1000 }, vigentes);
  assert.equal(r.computo_salarios_minimos, 249.55);
  assert.equal(r.credito_aplicado, 0);
  assert.equal(r.saldo_favor_siguiente, 130);
});

test("el saldo del mes anterior se suma al crédito disponible", () => {
  const r = calcularRetencion({ ...ALTO, montoFacturas: 3000, saldoMesAnterior: 100 }, vigentes);
  assert.equal(r.saldo_mes_anterior, 100);
  assert.equal(r.actualizacion_ufv, 0);
  assert.equal(r.saldo_anterior_favor, 100);
  assert.equal(r.credito_aplicado, 272.16);
  assert.equal(r.saldo_favor_siguiente, 217.84);
});

test("el saldo del mes anterior se actualiza con la variación de la UFV", () => {
  const ufv = { inicial: 2.7184, final: 2.7246 };
  const r = calcularRetencion({ ...ALTO, saldoMesAnterior: 100, ufv }, vigentes);
  assert.equal(r.saldo_mes_anterior, 100);
  assert.equal(r.actualizacion_ufv, 0.23);
  assert.equal(r.saldo_anterior_favor, 100.23);
  assert.equal(r.credito_aplicado, 100.23);
  assert.equal(r.impuesto_retenido, 171.93);
});

test("actualizarConUfv no reduce el saldo si la UFV no sube y tolera valores faltantes", () => {
  assert.equal(actualizarConUfv(10000, { inicial: 2.7246, final: 2.7184 }), 10000);
  assert.equal(actualizarConUfv(10000, { inicial: 2.7, final: 2.7 }), 10000);
  assert.equal(actualizarConUfv(10000, null), 10000);
  assert.equal(actualizarConUfv(0, { inicial: 2.7, final: 2.8 }), 0);
  assert.equal(actualizarConUfv(52000, { inicial: 2.7184, final: 2.7246 }), 52119);
});

test("sin impuesto, el crédito completo se conserva como saldo", () => {
  const r = calcularRetencion({ totalGanado: 3000, aportesLaborales: 300, montoFacturas: 1000, saldoMesAnterior: 20 }, vigentes);
  assert.equal(r.impuesto_determinado, 0);
  assert.equal(r.credito_aplicado, 0);
  assert.equal(r.saldo_favor_siguiente, 150);
});

test("el cambio de salario mínimo cambia el impuesto y el cómputo del mismo sueldo", () => {
  assert.equal(calcularRetencion(ALTO, vigentes).impuesto_retenido, 272.16);
  const antes = calcularRetencion(ALTO, anteriores);
  assert.equal(antes.base_imponible, 8093.5);
  assert.equal(antes.impuesto_determinado, 1052.16);
  assert.equal(antes.computo_salarios_minimos, 650);
  assert.equal(antes.impuesto_retenido, 402.16);
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
  assert.equal(porcentajeDe(759350, 13), 98716);
});

test("un cambio de la alícuota se refleja en el impuesto y en el cómputo", () => {
  const otra = resolverParametros(filasParametros(2750, 10));
  const r = calcularRetencion(ALTO, otra);
  assert.equal(r.impuesto_determinado, 759.35);
  assert.equal(r.computo_salarios_minimos, 550);
  assert.equal(r.impuesto_retenido, 209.35);
});

test("cada retención cuadra: impuesto = cómputo + crédito aplicado + retenido", () => {
  const casos = [
    ALTO,
    { ...ALTO, montoFacturas: 1000 },
    { ...ALTO, montoFacturas: 3000, saldoMesAnterior: 55.55, ufv: { inicial: 2.7, final: 2.71 } },
    { totalGanado: 8500, aportesLaborales: 1080.35, montoFacturas: 800 },
    { totalGanado: 11010, aportesLaborales: 0 },
  ];
  for (const caso of casos) {
    const r = calcularRetencion(caso, vigentes);
    assert.equal(
      Math.round(r.impuesto_determinado * 100),
      Math.round((r.computo_salarios_minimos + r.credito_aplicado + r.impuesto_retenido) * 100)
    );
    assert.equal(
      Math.round((r.credito_fiscal_facturas + r.saldo_anterior_favor) * 100),
      Math.round((r.credito_aplicado + r.saldo_favor_siguiente) * 100)
    );
  }
});

test("resumirRetenciones suma los totales y cuenta quienes retienen", () => {
  const filas = [
    calcularRetencion({ totalGanado: 4000, aportesLaborales: 508.4 }, vigentes),
    calcularRetencion({ ...ALTO, montoFacturas: 1000 }, vigentes),
    calcularRetencion({ ...ALTO, montoFacturas: 3000, saldoMesAnterior: 100, ufv: { inicial: 2.7184, final: 2.7246 } }, vigentes),
  ];
  const totales = resumirRetenciones(filas);
  assert.equal(totales.cantidad_dependientes, 3);
  assert.equal(totales.dependientes_con_retencion, 1);
  assert.equal(totales.total_impuesto_determinado, 1974.32);
  assert.equal(totales.total_computo_salarios_minimos, 1430);
  assert.equal(totales.total_credito_aplicado, 402.16);
  assert.equal(totales.total_impuesto_retenido, 142.16);
  assert.equal(totales.total_actualizacion_ufv, 0.23);
});

test("periodoAnterior y finDePeriodo cruzan el cambio de año y los meses cortos", () => {
  assert.equal(periodoAnterior("2026-05"), "2026-04");
  assert.equal(periodoAnterior("2026-01"), "2025-12");
  assert.equal(finDePeriodo("2026-02"), "2026-02-28");
  assert.equal(finDePeriodo("2024-02"), "2024-02-29");
  assert.equal(finDePeriodo("2026-12"), "2026-12-31");
});
