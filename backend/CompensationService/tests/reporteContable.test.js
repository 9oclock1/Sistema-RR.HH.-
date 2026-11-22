const { test } = require("node:test");
const assert = require("node:assert/strict");
const { agruparPorCentroDeCosto, CUENTAS } = require("../src/utils/integraciones");
const { agruparAguinaldoPorCentroDeCosto, CUENTA_AGUINALDO } = require("../src/utils/aguinaldo");
const { construirReportePlanilla, construirReporteAguinaldo } = require("../src/utils/reporteContable");

const concepto = (sucursal, tipo, monto, cuenta = ["5.1.1.01", "Sueldos y salarios"]) => ({
  sucursal,
  tipo,
  codigo: "HABER-BASICO",
  cuenta_codigo: cuenta[0],
  cuenta_nombre: cuenta[1],
  monto,
});

test("agruparPorCentroDeCosto: separa gasto (debe) y pasivo (haber) por sucursal, cada una cuadrada", () => {
  const filasConceptos = [
    concepto("Casa matriz", "INGRESO", 1000),
    concepto("Casa matriz", "DESCUENTO", 130, ["2.1.3.01", "Aportes laborales por pagar"]),
    concepto("Sucursal Santa Cruz", "INGRESO", 500),
  ];
  const filasPasivos = [
    { sucursal: "Casa matriz", liquido_pagable: 870, total_aportes: 100 },
    { sucursal: "Sucursal Santa Cruz", liquido_pagable: 500, total_aportes: 50 },
  ];
  const centros = agruparPorCentroDeCosto({ filasConceptos, filasPasivos });

  assert.equal(centros.length, 2);
  const matriz = centros.find((c) => c.centro_costo === "Casa matriz");
  assert.equal(matriz.total_debe, 1000);
  assert.equal(matriz.total_haber, 1100); // 130 (descuento) + 100 (aportes patronales) + 870 (líquido)
  const haberSueldos = matriz.renglones.find((r) => r.cuenta.codigo === CUENTAS.SUELDOS_POR_PAGAR.codigo);
  assert.equal(haberSueldos.haber, 870);

  const santaCruz = centros.find((c) => c.centro_costo === "Sucursal Santa Cruz");
  assert.equal(santaCruz.total_debe, 500);
  assert.equal(santaCruz.total_haber, 550); // 50 aportes + 500 líquido
});

test("agruparPorCentroDeCosto: sin sucursal registrada, agrupa bajo '(sin sucursal)' sin perder el monto", () => {
  const centros = agruparPorCentroDeCosto({
    filasConceptos: [concepto(null, "INGRESO", 300)],
    filasPasivos: [{ sucursal: null, liquido_pagable: 300, total_aportes: 0 }],
  });
  assert.equal(centros.length, 1);
  assert.equal(centros[0].centro_costo, "(sin sucursal)");
  assert.equal(centros[0].total_debe, 300);
  assert.equal(centros[0].total_haber, 300);
});

test("agruparPorCentroDeCosto: un concepto sin cuenta contable no se descarta, cae en '(sin cuenta contable asignada)'", () => {
  const centros = agruparPorCentroDeCosto({
    filasConceptos: [concepto("Casa matriz", "APORTE", 80, [null, null])],
    filasPasivos: [{ sucursal: "Casa matriz", liquido_pagable: 0, total_aportes: 80 }],
  });
  const renglonSinCuenta = centros[0].renglones.find((r) => r.cuenta.codigo === "—");
  assert.ok(renglonSinCuenta, "debe existir un renglón de respaldo para el monto sin cuenta");
  assert.equal(renglonSinCuenta.debe, 80);
  assert.equal(centros[0].total_debe, 80);
});

test("agruparAguinaldoPorCentroDeCosto: un par debe/haber por sucursal, usando la cuenta de aguinaldos", () => {
  const centros = agruparAguinaldoPorCentroDeCosto([
    { sucursal: "Casa matriz", monto: 2000 },
    { sucursal: "Sucursal Santa Cruz", monto: 1500 },
  ]);
  assert.equal(centros.length, 2);
  assert.deepEqual(
    centros[0].renglones.map((r) => r.cuenta.codigo),
    [CUENTA_AGUINALDO.codigo, CUENTAS.SUELDOS_POR_PAGAR.codigo]
  );
  assert.equal(centros[0].total_debe, 2000);
  assert.equal(centros[0].total_haber, 2000);
});

const PLANILLA_BASE = {
  id_planilla: "6f1d2c3b-4a59-4e68-9d7c-8b9a0f1e2d3c",
  periodo: "2026-10",
  estado: "APROBADA",
  colaboradores: 2,
  estado_contabilidad: "CONFIRMADA",
  referencia_contabilidad: "AST-001",
  motivo_contabilidad: null,
  respondida_contabilidad_en: "2026-11-05T10:00:00Z",
  estado_pagos: "RECHAZADA",
  referencia_pagos: null,
  motivo_pagos: "Cuenta bancaria inválida",
  respondida_pagos_en: "2026-11-05T10:05:00Z",
};

test("construirReportePlanilla: traduce estado_contabilidad/estado_pagos al vocabulario de conciliación", () => {
  const reporte = construirReportePlanilla({
    planilla: PLANILLA_BASE,
    filasConceptos: [concepto("Casa matriz", "INGRESO", 1000)],
    filasPasivos: [{ sucursal: "Casa matriz", liquido_pagable: 1000, total_aportes: 0 }],
  });
  assert.equal(reporte.recurso, "PLANILLA");
  assert.equal(reporte.conciliacion.contabilidad.estado, "registrado");
  assert.equal(reporte.conciliacion.contabilidad.referencia, "AST-001");
  assert.equal(reporte.conciliacion.pagos.estado, "con_error");
  assert.equal(reporte.conciliacion.pagos.motivo, "Cuenta bancaria inválida");
  assert.equal(reporte.totales.cuadra, true);
});

test("construirReportePlanilla: con PENDIENTE en ambos destinos reporta 'pendiente'", () => {
  const reporte = construirReportePlanilla({
    planilla: { ...PLANILLA_BASE, estado_contabilidad: "PENDIENTE", estado_pagos: "PENDIENTE" },
    filasConceptos: [],
    filasPasivos: [],
  });
  assert.equal(reporte.conciliacion.contabilidad.estado, "pendiente");
  assert.equal(reporte.conciliacion.pagos.estado, "pendiente");
  assert.equal(reporte.totales.total_debe, 0);
  assert.equal(reporte.totales.cuadra, true);
});

test("construirReporteAguinaldo: usa gestion en vez de periodo y cuadra por centro de costo", () => {
  const aguinaldo = {
    id_aguinaldo: "d85d68d0-51dd-43a5-9e35-efcdc80ba76f",
    gestion: 2023,
    estado: "CERRADA",
    colaboradores: 2,
    estado_contabilidad: "CONFIRMADA",
    referencia_contabilidad: "AST-200",
    motivo_contabilidad: null,
    respondida_contabilidad_en: "2024-01-05T10:00:00Z",
    estado_pagos: "CONFIRMADA",
    referencia_pagos: "ORD-200",
    motivo_pagos: null,
    respondida_pagos_en: "2024-01-05T10:05:00Z",
  };
  const reporte = construirReporteAguinaldo({
    aguinaldo,
    filasPorCentro: [
      { sucursal: "Casa matriz", monto: 6000 },
      { sucursal: "Sucursal Santa Cruz", monto: 9800 },
    ],
  });
  assert.equal(reporte.recurso, "AGUINALDO");
  assert.equal(reporte.gestion, 2023);
  assert.equal(reporte.totales.total_debe, 15800);
  assert.equal(reporte.totales.total_haber, 15800);
  assert.equal(reporte.conciliacion.contabilidad.estado, "registrado");
  assert.equal(reporte.conciliacion.pagos.estado, "registrado");
});
