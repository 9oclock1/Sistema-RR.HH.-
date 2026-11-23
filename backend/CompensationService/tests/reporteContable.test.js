const { test } = require("node:test");
const assert = require("node:assert/strict");
const { agruparPorCentroDeCosto, CUENTAS } = require("../src/utils/integraciones");
const { agruparAguinaldoPorCentroDeCosto, CUENTA_AGUINALDO } = require("../src/utils/aguinaldo");
const { construirReportePlanilla, construirReporteAguinaldo } = require("../src/utils/reporteContable");

const concepto = (sucursal, area, tipo, monto, cuenta = ["5.1.1.01", "Sueldos y salarios"]) => ({
  sucursal,
  area,
  tipo,
  codigo: "HABER-BASICO",
  cuenta_codigo: cuenta[0],
  cuenta_nombre: cuenta[1],
  monto,
});

test("agruparPorCentroDeCosto: separa gasto (debe) y pasivo (haber) por sucursal Y área, cada una cuadrada", () => {
  const filasConceptos = [
    concepto("Casa matriz", "Administración", "INGRESO", 1000),
    concepto("Casa matriz", "Administración", "DESCUENTO", 130, ["2.1.3.01", "Aportes laborales por pagar"]),
    concepto("Sucursal Santa Cruz", "Ventas", "INGRESO", 500),
  ];
  const filasPasivos = [
    { sucursal: "Casa matriz", area: "Administración", liquido_pagable: 870, total_aportes: 100 },
    { sucursal: "Sucursal Santa Cruz", area: "Ventas", liquido_pagable: 500, total_aportes: 50 },
  ];
  const centros = agruparPorCentroDeCosto({ filasConceptos, filasPasivos });

  assert.equal(centros.length, 2);
  const matriz = centros.find((c) => c.sucursal === "Casa matriz");
  assert.equal(matriz.centro_costo, "Casa matriz · Administración");
  assert.equal(matriz.area, "Administración");
  assert.equal(matriz.total_debe, 1000);
  assert.equal(matriz.total_haber, 1100); // 130 (descuento) + 100 (aportes patronales) + 870 (líquido)
  const haberSueldos = matriz.renglones.find((r) => r.cuenta.codigo === CUENTAS.SUELDOS_POR_PAGAR.codigo);
  assert.equal(haberSueldos.haber, 870);

  const santaCruz = centros.find((c) => c.sucursal === "Sucursal Santa Cruz");
  assert.equal(santaCruz.centro_costo, "Sucursal Santa Cruz · Ventas");
  assert.equal(santaCruz.total_debe, 500);
  assert.equal(santaCruz.total_haber, 550); // 50 aportes + 500 líquido
});

test("agruparPorCentroDeCosto: misma sucursal con áreas distintas no se mezcla", () => {
  const centros = agruparPorCentroDeCosto({
    filasConceptos: [
      concepto("Casa matriz", "Administración", "INGRESO", 1000),
      concepto("Casa matriz", "Ventas", "INGRESO", 400),
    ],
    filasPasivos: [
      { sucursal: "Casa matriz", area: "Administración", liquido_pagable: 1000, total_aportes: 0 },
      { sucursal: "Casa matriz", area: "Ventas", liquido_pagable: 400, total_aportes: 0 },
    ],
  });
  assert.equal(centros.length, 2);
  assert.deepEqual(
    centros.map((c) => c.centro_costo).sort(),
    ["Casa matriz · Administración", "Casa matriz · Ventas"]
  );
});

test("agruparPorCentroDeCosto: sin sucursal ni área, agrupa bajo '(sin sucursal) · (sin área)' sin perder el monto", () => {
  const centros = agruparPorCentroDeCosto({
    filasConceptos: [concepto(null, null, "INGRESO", 300)],
    filasPasivos: [{ sucursal: null, area: null, liquido_pagable: 300, total_aportes: 0 }],
  });
  assert.equal(centros.length, 1);
  assert.equal(centros[0].centro_costo, "(sin sucursal) · (sin área)");
  assert.equal(centros[0].sucursal, "(sin sucursal)");
  assert.equal(centros[0].area, "(sin área)");
  assert.equal(centros[0].total_debe, 300);
  assert.equal(centros[0].total_haber, 300);
});

test("agruparPorCentroDeCosto: con sucursal pero sin área, solo el área cae en '(sin área)'", () => {
  const centros = agruparPorCentroDeCosto({
    filasConceptos: [concepto("Casa matriz", null, "INGRESO", 200)],
    filasPasivos: [{ sucursal: "Casa matriz", area: null, liquido_pagable: 200, total_aportes: 0 }],
  });
  assert.equal(centros[0].centro_costo, "Casa matriz · (sin área)");
});

test("agruparPorCentroDeCosto: un concepto sin cuenta contable no se descarta, cae en '(sin cuenta contable asignada)'", () => {
  const centros = agruparPorCentroDeCosto({
    filasConceptos: [concepto("Casa matriz", "Administración", "APORTE", 80, [null, null])],
    filasPasivos: [{ sucursal: "Casa matriz", area: "Administración", liquido_pagable: 0, total_aportes: 80 }],
  });
  const renglonSinCuenta = centros[0].renglones.find((r) => r.cuenta.codigo === "—");
  assert.ok(renglonSinCuenta, "debe existir un renglón de respaldo para el monto sin cuenta");
  assert.equal(renglonSinCuenta.debe, 80);
  assert.equal(centros[0].total_debe, 80);
});

test("agruparAguinaldoPorCentroDeCosto: un par debe/haber por sucursal y área, usando la cuenta de aguinaldos", () => {
  const centros = agruparAguinaldoPorCentroDeCosto([
    { sucursal: "Casa matriz", area: "Administración", monto: 2000 },
    { sucursal: "Sucursal Santa Cruz", area: "Ventas", monto: 1500 },
  ]);
  assert.equal(centros.length, 2);
  assert.equal(centros[0].centro_costo, "Casa matriz · Administración");
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
    filasConceptos: [concepto("Casa matriz", "Administración", "INGRESO", 1000)],
    filasPasivos: [{ sucursal: "Casa matriz", area: "Administración", liquido_pagable: 1000, total_aportes: 0 }],
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

test("construirReportePlanilla: con un aguinaldo cerrado ese mes, lo funde en los mismos centros de costo", () => {
  const reporte = construirReportePlanilla({
    planilla: { ...PLANILLA_BASE, estado: "CERRADA" },
    filasConceptos: [concepto("Casa matriz", "Administración", "INGRESO", 1000)],
    filasPasivos: [{ sucursal: "Casa matriz", area: "Administración", liquido_pagable: 1000, total_aportes: 0 }],
    aguinaldo: { id_aguinaldo: "f1e2d3c4-b5a6-4978-8899-aabbccddeeff", gestion: 2026 },
    filasAguinaldo: [{ sucursal: "Casa matriz", area: "Administración", monto: 500 }],
  });
  assert.equal(reporte.aguinaldo_incluido.gestion, 2026);
  // Sueldos y salarios por pagar (haber) ahora trae el líquido de la planilla (1000) MÁS el del aguinaldo (500).
  const centro = reporte.centros_costo.find((c) => c.centro_costo === "Casa matriz · Administración");
  const sueldosPorPagar = centro.renglones.find((r) => r.cuenta.codigo === CUENTAS.SUELDOS_POR_PAGAR.codigo);
  assert.equal(sueldosPorPagar.haber, 1500);
  // El debe también crece: 1000 de sueldos (planilla) + 500 de la cuenta de aguinaldos.
  assert.equal(reporte.totales.total_debe, 1500);
  assert.equal(reporte.totales.total_haber, 1500);
  assert.equal(reporte.totales.cuadra, true);
});

test("construirReportePlanilla: sin aguinaldo cerrado ese mes, no agrega aguinaldo_incluido ni cambia los totales", () => {
  const reporte = construirReportePlanilla({
    planilla: { ...PLANILLA_BASE, estado: "CERRADA" },
    filasConceptos: [concepto("Casa matriz", "Administración", "INGRESO", 1000)],
    filasPasivos: [{ sucursal: "Casa matriz", area: "Administración", liquido_pagable: 1000, total_aportes: 0 }],
  });
  assert.equal(reporte.aguinaldo_incluido, null);
  assert.equal(reporte.totales.total_debe, 1000);
});
