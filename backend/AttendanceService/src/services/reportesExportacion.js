const PDFDocument = require("pdfkit");

// RF-29 (criterios 2 y 3): el reporte de asistencia en CSV (hojas de cálculo) y PDF, con los mismos indicadores.

const fecha = (texto) => texto.split("-").reverse().join("/");
const decimal = (valor, digitos) => valor.toFixed(digitos).replace(".", ",");
const horas = (minutos) => decimal(minutos / 60, 2);
const porciento = (valor) => (valor === null ? "—" : `${decimal(valor, 1)} %`);

const nombreArchivo = ({ filtros }, extension) => `reporte-asistencia_${filtros.desde}_${filtros.hasta_efectiva}.${extension}`;

const descripcionAlcance = ({ filtros, alcance }) =>
  [
    `Sucursal: ${filtros.sucursal?.nombre ?? (filtros.sucursal ? "—" : "Todas")}`,
    `Área: ${filtros.area?.nombre ?? (filtros.area ? "—" : "Todas")}`,
    alcance.supervisor ? `Personal a cargo de ${alcance.supervisor.nombre_completo}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

const periodo = ({ filtros }) =>
  `Del ${fecha(filtros.desde)} al ${fecha(filtros.hasta_efectiva)}` +
  (filtros.hasta_efectiva < filtros.hasta ? " (jornadas cerradas hasta ayer)" : "");

// Columnas comunes a ambos formatos. `pdf` es el ancho relativo en la tabla del PDF.
const COLUMNAS = [
  { titulo: "Empleado", valor: (f) => f.empleado.nombre_completo, pdf: 3.2, texto: true },
  { titulo: "Cargo", valor: (f) => f.empleado.cargo ?? "", soloCsv: true },
  { titulo: "Área", valor: (f) => f.empleado.area ?? "", soloCsv: true },
  { titulo: "Sucursal", valor: (f) => f.empleado.sucursal ?? "", soloCsv: true },
  { titulo: "Días programados", corto: "Días prog.", valor: (f) => f.dias_programados, pdf: 1 },
  { titulo: "Días asistidos", corto: "Asistidos", valor: (f) => f.dias_asistidos, pdf: 1 },
  { titulo: "Faltas justificadas", corto: "Faltas just.", valor: (f) => f.faltas_justificadas, pdf: 1 },
  { titulo: "Faltas injustificadas", corto: "Faltas injust.", valor: (f) => f.faltas_injustificadas, pdf: 1.1 },
  { titulo: "Ausentismo (%)", corto: "% Ausentismo", valor: (f) => porciento(f.porcentaje_ausentismo), pdf: 1.1 },
  { titulo: "Atrasos", valor: (f) => f.atrasos, pdf: 0.9 },
  { titulo: "Minutos de retraso", corto: "Min. retraso", valor: (f) => f.minutos_retraso, pdf: 1 },
  { titulo: "Puntualidad (%)", corto: "% Puntualidad", valor: (f) => porciento(f.porcentaje_puntualidad), pdf: 1.1 },
  { titulo: "Salidas anticipadas", corto: "Salidas antic.", valor: (f) => f.salidas_anticipadas, pdf: 1 },
  { titulo: "Horas extra aprobadas", corto: "Horas extra", valor: (f) => horas(f.minutos_extra), pdf: 1 },
];

const filaTotales = (totales) => ({
  empleado: { nombre_completo: `TOTAL (${totales.empleados} empleados)`, cargo: "", area: "", sucursal: "" },
  ...totales,
});

const celda = (valor) => {
  const texto = String(valor ?? "");
  return /[";\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

// Mismo formato que el CSV de horas extra: punto y coma, decimales con coma y BOM para que Excel lea los acentos.
function aCsv(reporte) {
  const linea = (valores) => valores.map(celda).join(";");
  const contenido = [
    linea(["Reporte de asistencia"]),
    linea([descripcionAlcance(reporte)]),
    linea([periodo(reporte)]),
    "",
    linea(COLUMNAS.map((c) => c.titulo)),
    ...reporte.empleados.map((f) => linea(COLUMNAS.map((c) => c.valor(f)))),
    linea(COLUMNAS.map((c) => c.valor(filaTotales(reporte.totales)))),
  ];
  return { nombre: nombreArchivo(reporte, "csv"), contenido: `﻿${contenido.join("\r\n")}\r\n` };
}

// Mismos tonos que DESIGN.md.
const COLOR = { primario: "#1868DB", texto: "#292A2E", secundario: "#505258", borde: "#DDDEE1", fondo: "#F8F8F8" };
const FUENTE = { normal: "Helvetica", negrita: "Helvetica-Bold" };
const MARGEN = 36;
const ALTO_FILA = 18;
const ALTO_PIE = 28;

const fechaHora = new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", dateStyle: "short", timeStyle: "short" });

function dibujarEncabezado(doc, reporte) {
  const ancho = doc.page.width - MARGEN * 2;
  doc.font(FUENTE.negrita).fontSize(16).fillColor(COLOR.primario).text("Reporte de asistencia", MARGEN, MARGEN);
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario);
  doc.text(descripcionAlcance(reporte), { width: ancho });
  doc.text(`${periodo(reporte)} · Generado el ${fechaHora.format(new Date(reporte.generado_en))}`, { width: ancho });
  doc.moveDown(0.6);

  // Indicadores clave del conjunto (criterio 3).
  const t = reporte.totales;
  const indicadores = [
    ["Empleados", String(t.empleados)],
    ["Ausentismo", porciento(t.porcentaje_ausentismo)],
    ["Faltas just. / injust.", `${t.faltas_justificadas} / ${t.faltas_injustificadas}`],
    ["Minutos de retraso", String(t.minutos_retraso)],
    ["Puntualidad", porciento(t.porcentaje_puntualidad)],
    ["Horas extra aprobadas", horas(t.minutos_extra)],
  ];
  const y = doc.y;
  const anchoCaja = ancho / indicadores.length;
  indicadores.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + i * anchoCaja;
    doc.rect(x + 2, y, anchoCaja - 4, 38).fillAndStroke(COLOR.fondo, COLOR.borde);
    doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario).text(etiqueta, x + 8, y + 6, { width: anchoCaja - 16 });
    doc.font(FUENTE.negrita).fontSize(12).fillColor(COLOR.texto).text(valor, x + 8, y + 19, { width: anchoCaja - 16 });
  });
  doc.y = y + 50;
}

function posiciones(doc) {
  const columnas = COLUMNAS.filter((c) => !c.soloCsv);
  const ancho = doc.page.width - MARGEN * 2;
  const unidad = ancho / columnas.reduce((s, c) => s + c.pdf, 0);
  let x = MARGEN;
  return columnas.map((c) => {
    const pos = { ...c, x, ancho: c.pdf * unidad };
    x += pos.ancho;
    return pos;
  });
}

function dibujarFila(doc, columnas, valores, { negrita = false, fondo = null, encabezado = false } = {}) {
  const y = doc.y;
  const alto = encabezado ? ALTO_FILA + 6 : ALTO_FILA;
  if (fondo) doc.rect(MARGEN, y, doc.page.width - MARGEN * 2, alto).fill(fondo);
  doc.font(negrita || encabezado ? FUENTE.negrita : FUENTE.normal).fontSize(encabezado ? 7.5 : 8);
  doc.fillColor(encabezado ? COLOR.secundario : COLOR.texto);
  columnas.forEach((c, i) => {
    doc.text(String(valores[i]), c.x + 4, y + 5, {
      width: c.ancho - 8,
      height: alto - 6,
      align: c.texto ? "left" : "right",
      ellipsis: true,
      lineBreak: encabezado,
    });
  });
  doc.moveTo(MARGEN, y + alto).lineTo(doc.page.width - MARGEN, y + alto).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
  doc.y = y + alto;
}

function dibujarPies(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i += 1) {
    doc.switchToPage(i);
    // Sin margen inferior, pdfkit no abre una página nueva al escribir en el pie.
    doc.page.margins.bottom = 0;
    doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario);
    doc.text(`Página ${i + 1} de ${count}`, MARGEN, doc.page.height - ALTO_PIE, {
      width: doc.page.width - MARGEN * 2,
      align: "right",
      lineBreak: false,
    });
  }
}

// PDF apaisado: encabezado con indicadores, tabla por empleado (repite títulos en cada página) y fila de totales.
function aPdf(reporte) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: MARGEN, bufferPages: true });
    const partes = [];
    doc.on("data", (parte) => partes.push(parte));
    doc.on("end", () => resolve({ nombre: nombreArchivo(reporte, "pdf"), contenido: Buffer.concat(partes) }));
    doc.on("error", reject);

    dibujarEncabezado(doc, reporte);
    const columnas = posiciones(doc);
    const titulos = () => dibujarFila(doc, columnas, columnas.map((c) => c.corto ?? c.titulo), { encabezado: true, fondo: COLOR.fondo });
    const limite = () => doc.page.height - MARGEN - ALTO_PIE;

    titulos();
    if (reporte.empleados.length === 0) {
      doc.moveDown();
      doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text("No hay personal en el alcance y filtros elegidos.", MARGEN);
    }
    for (const fila of reporte.empleados) {
      if (doc.y + ALTO_FILA > limite()) {
        doc.addPage();
        doc.y = MARGEN;
        titulos();
      }
      dibujarFila(doc, columnas, columnas.map((c) => c.valor(fila)));
    }
    if (reporte.empleados.length > 0) {
      if (doc.y + ALTO_FILA > limite()) {
        doc.addPage();
        doc.y = MARGEN;
        titulos();
      }
      dibujarFila(doc, columnas, columnas.map((c) => c.valor(filaTotales(reporte.totales))), { negrita: true, fondo: COLOR.fondo });
    }

    doc.moveDown(0.8);
    doc.font(FUENTE.normal).fontSize(7.5).fillColor(COLOR.secundario).text(
      "Ausentismo: faltas (justificadas e injustificadas) sobre días programados. Puntualidad: días asistidos sin atraso " +
        "sin justificar sobre días asistidos. Minutos de retraso y salidas anticipadas: solo los no justificados. " +
        "Horas extra: las aprobadas por la jefatura.",
      MARGEN,
      doc.y,
      { width: doc.page.width - MARGEN * 2 }
    );

    dibujarPies(doc);
    doc.end();
  });
}

module.exports = { aCsv, aPdf };
