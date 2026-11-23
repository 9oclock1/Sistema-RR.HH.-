// RF-49 (KAN-69), criterio 3: el reporte contable se descarga en Excel y PDF con los mismos totales que en
// pantalla y con la conciliación de cada asiento (criterio 2).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { construirReportePlanilla } = require("../src/utils/reporteContable");
const { aXlsx, aPdf } = require("../src/services/reporteContableExportacion");

const concepto = (sucursal, area, tipo, monto, cuenta) => ({
  sucursal,
  area,
  tipo,
  codigo: "C",
  cuenta_codigo: cuenta[0],
  cuenta_nombre: cuenta[1],
  monto,
});
const SUELDOS = ["5.1.1.01", "Sueldos y salarios"];
const APORTES_LABORALES = ["2.1.3.01", "Aportes laborales por pagar"];

// Planilla APROBADA: Contabilidad ya la registró y Pagos sigue pendiente; se fundió el aguinaldo de ese mes,
// que Contabilidad rechazó. Tres estados distintos que deben salir en el archivo.
function reporteDePrueba() {
  return construirReportePlanilla({
    planilla: {
      id_planilla: "p1",
      periodo: "2026-12",
      estado: "APROBADA",
      colaboradores: 2,
      estado_contabilidad: "CONFIRMADA",
      referencia_contabilidad: "AS-991",
      estado_pagos: "PENDIENTE",
    },
    filasConceptos: [
      concepto("Sopocachi", "Cajas", "INGRESO", 1000, SUELDOS),
      concepto("Sopocachi", "Cajas", "DESCUENTO", 127.1, APORTES_LABORALES),
      concepto("Miraflores", "Ventas", "INGRESO", 500, SUELDOS),
    ],
    filasPasivos: [
      { sucursal: "Sopocachi", area: "Cajas", liquido_pagable: 872.9, total_aportes: 0 },
      { sucursal: "Miraflores", area: "Ventas", liquido_pagable: 500, total_aportes: 0 },
    ],
    aguinaldo: {
      id_aguinaldo: "a1",
      gestion: 2026,
      estado: "APROBADA",
      estado_contabilidad: "RECHAZADA",
      motivo_contabilidad: "Cuenta inexistente",
      estado_pagos: "PENDIENTE",
    },
    filasAguinaldo: [{ sucursal: "Sopocachi", area: "Cajas", monto: 1000 }],
  });
}

const valores = (hoja) => {
  const filas = [];
  hoja.eachRow((fila) => filas.push(fila.values.slice(1)));
  return filas;
};

test("Excel: un .xlsx válido con la conciliación de cada asiento y totales que cuadran con el reporte", async () => {
  const reporte = reporteDePrueba();
  assert.equal(reporte.asientos.length, 2);

  const { nombre, contenido } = await aXlsx(reporte);
  assert.equal(nombre, "reporte-contable_planilla_2026-12.xlsx");

  const libro = new ExcelJS.Workbook();
  await libro.xlsx.load(contenido);
  const hoja = libro.getWorksheet("Reporte contable");
  const filas = valores(hoja);
  const textoDe = (etiqueta) => filas.find((f) => f[0] === etiqueta)?.[1];

  assert.equal(textoDe("Asiento planilla 2026-12 · Contabilidad"), "Registrado · ref. AS-991");
  assert.equal(textoDe("Asiento planilla 2026-12 · Pagos"), "Pendiente");
  assert.equal(textoDe("Asiento aguinaldo gestión 2026 · Contabilidad"), "Con error · Cuenta inexistente");
  assert.equal(textoDe("Asiento aguinaldo gestión 2026 · Pagos"), "Pendiente");

  const total = filas.find((f) => f[0] === "TOTAL GENERAL");
  assert.equal(total[4], reporte.totales.total_debe);
  assert.equal(total[5], reporte.totales.total_haber);
  assert.equal(total[4], total[5]);

  // La suma de los renglones del archivo coincide con el total general (nada se pierde al exportar).
  const renglones = filas.filter((f) => typeof f[2] === "string" && /^\d/.test(f[2]));
  const suma = (i) => Math.round(renglones.reduce((t, f) => t + (f[i] ?? 0), 0) * 100) / 100;
  assert.equal(suma(4), reporte.totales.total_debe);
  assert.equal(suma(5), reporte.totales.total_haber);

  // El encabezado de la tabla queda fijo aunque cambie la cantidad de asientos.
  let filaEncabezado = null;
  hoja.eachRow((fila, numero) => {
    if (fila.getCell(1).value === "Sucursal") filaEncabezado = numero;
  });
  assert.equal(hoja.views[0].ySplit, filaEncabezado);
});

test("PDF: se genera un PDF válido con el reporte de dos asientos", async () => {
  const { nombre, contenido } = await aPdf(reporteDePrueba());
  assert.equal(nombre, "reporte-contable_planilla_2026-12.pdf");
  assert.equal(contenido.subarray(0, 5).toString(), "%PDF-");
  assert.ok(contenido.toString("latin1").trimEnd().endsWith("%%EOF"));
});
