const PDFDocument = require("pdfkit");

// RF-49 (criterio 3): el reporte contable consolidado en CSV (hojas de cálculo) y PDF, con los mismos totales
// que en pantalla, para que el Contador los adjunte a la conciliación con Contabilidad.

const decimal = (valor) => Number(valor).toFixed(2).replace(".", ",");
const ESTADO_CONCILIACION_TEXTO = { registrado: "Registrado", pendiente: "Pendiente", con_error: "Con error" };

const identificador = (reporte) => (reporte.recurso === "PLANILLA" ? reporte.periodo : `gestión ${reporte.gestion}`);

const nombreArchivo = (reporte, extension) => {
  const sufijo = reporte.recurso === "PLANILLA" ? reporte.periodo : `gestion-${reporte.gestion}`;
  return `reporte-contable_${reporte.recurso.toLowerCase()}_${sufijo}.${extension}`;
};

const tituloConciliacion = ({ estado, referencia, motivo }) =>
  [ESTADO_CONCILIACION_TEXTO[estado], referencia && `ref. ${referencia}`, motivo].filter(Boolean).join(" · ");

// Si el valor empieza con = + - @ (o tabulador), Excel lo interpreta como fórmula al abrir el CSV, nunca
// como texto: una sucursal o cuenta con ese nombre ejecutaría esa fórmula. El apóstrofo le dice que es
// texto literal; es invisible al verlo y no afecta el valor.
const celda = (valor) => {
  const texto = String(valor ?? "");
  const segura = /^[=+\-@\t\r]/.test(texto) ? `'${texto}` : texto;
  return /[";\n\r]/.test(segura) ? `"${segura.replace(/"/g, '""')}"` : segura;
};

function aCsv(reporte) {
  const linea = (valores) => valores.map(celda).join(";");
  const contenido = [
    linea(["Reporte contable consolidado"]),
    linea([`Recurso: ${reporte.recurso === "PLANILLA" ? "Planilla mensual" : "Planilla de aguinaldos"}`]),
    linea([`Periodo: ${identificador(reporte)}`]),
    linea([`Estado: ${reporte.estado}`, `Colaboradores: ${reporte.colaboradores}`]),
    linea(["Conciliación Contabilidad", tituloConciliacion(reporte.conciliacion.contabilidad)]),
    linea(["Conciliación Pagos", tituloConciliacion(reporte.conciliacion.pagos)]),
    "",
    linea(["Centro de costo", "Cuenta", "Nombre de cuenta", "Debe", "Haber"]),
  ];
  for (const centro of reporte.centros_costo) {
    for (const r of centro.renglones) {
      contenido.push(
        linea([centro.centro_costo, r.cuenta.codigo, r.cuenta.nombre, r.debe > 0 ? decimal(r.debe) : "", r.haber > 0 ? decimal(r.haber) : ""])
      );
    }
    contenido.push(linea([`Total ${centro.centro_costo}`, "", "", decimal(centro.total_debe), decimal(centro.total_haber)]));
  }
  contenido.push(linea(["TOTAL GENERAL", "", "", decimal(reporte.totales.total_debe), decimal(reporte.totales.total_haber)]));
  return { nombre: nombreArchivo(reporte, "csv"), contenido: `﻿${contenido.join("\r\n")}\r\n` };
}

const COLOR = { primario: "#1868DB", texto: "#292A2E", secundario: "#505258", borde: "#DDDEE1", fondo: "#F8F8F8" };
const FUENTE = { normal: "Helvetica", negrita: "Helvetica-Bold" };
const MARGEN = 40;
const ALTO_FILA = 18;
const ALTO_PIE = 28;
const COLUMNAS = [
  { titulo: "Centro de costo", ancho: 2.4, texto: true },
  { titulo: "Cuenta", ancho: 1 },
  { titulo: "Nombre de cuenta", ancho: 2.6, texto: true },
  { titulo: "Debe", ancho: 1 },
  { titulo: "Haber", ancho: 1 },
];

const fechaHora = new Intl.DateTimeFormat("es-BO", { timeZone: "America/La_Paz", dateStyle: "short", timeStyle: "short" });

function posiciones(doc) {
  const ancho = doc.page.width - MARGEN * 2;
  const unidad = ancho / COLUMNAS.reduce((s, c) => s + c.ancho, 0);
  let x = MARGEN;
  return COLUMNAS.map((c) => {
    const pos = { ...c, x, ancho: c.ancho * unidad };
    x += pos.ancho;
    return pos;
  });
}

function dibujarFila(doc, columnas, valores, { negrita = false, fondo = null } = {}) {
  const y = doc.y;
  if (fondo) doc.rect(MARGEN, y, doc.page.width - MARGEN * 2, ALTO_FILA).fill(fondo);
  doc.font(negrita ? FUENTE.negrita : FUENTE.normal).fontSize(8.5).fillColor(COLOR.texto);
  columnas.forEach((c, i) => {
    doc.text(String(valores[i]), c.x + 4, y + 5, { width: c.ancho - 8, align: c.texto ? "left" : "right", ellipsis: true, lineBreak: false });
  });
  doc.moveTo(MARGEN, y + ALTO_FILA).lineTo(doc.page.width - MARGEN, y + ALTO_FILA).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
  doc.y = y + ALTO_FILA;
}

function dibujarEncabezado(doc, reporte) {
  const ancho = doc.page.width - MARGEN * 2;
  doc.font(FUENTE.negrita).fontSize(15).fillColor(COLOR.primario).text("Reporte contable consolidado", MARGEN, MARGEN);
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario);
  doc.text(
    `${reporte.recurso === "PLANILLA" ? "Planilla mensual" : "Planilla de aguinaldos"} · ${identificador(reporte)} · ` +
      `Estado: ${reporte.estado} · ${reporte.colaboradores} colaboradores · Generado el ${fechaHora.format(new Date())}`,
    { width: ancho }
  );
  doc.text(`Conciliación Contabilidad: ${tituloConciliacion(reporte.conciliacion.contabilidad)}`, { width: ancho });
  doc.text(`Conciliación Pagos: ${tituloConciliacion(reporte.conciliacion.pagos)}`, { width: ancho });
  doc.moveDown(0.6);
}

function dibujarPies(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario);
    doc.text(`Página ${i + 1} de ${count}`, MARGEN, doc.page.height - ALTO_PIE, {
      width: doc.page.width - MARGEN * 2,
      align: "right",
      lineBreak: false,
    });
  }
}

function aPdf(reporte) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGEN, bufferPages: true });
    const partes = [];
    doc.on("data", (parte) => partes.push(parte));
    doc.on("end", () => resolve({ nombre: nombreArchivo(reporte, "pdf"), contenido: Buffer.concat(partes) }));
    doc.on("error", reject);

    dibujarEncabezado(doc, reporte);
    const columnas = posiciones(doc);
    const titulos = () => dibujarFila(doc, columnas, columnas.map((c) => c.titulo), { negrita: true, fondo: COLOR.fondo });
    const limite = () => doc.page.height - MARGEN - ALTO_PIE;

    titulos();
    if (reporte.centros_costo.length === 0) {
      doc.moveDown();
      doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text("No hay gastos registrados en este periodo.", MARGEN);
    }
    for (const centro of reporte.centros_costo) {
      for (const r of centro.renglones) {
        if (doc.y + ALTO_FILA > limite()) {
          doc.addPage();
          doc.y = MARGEN;
          titulos();
        }
        dibujarFila(doc, columnas, [centro.centro_costo, r.cuenta.codigo, r.cuenta.nombre, r.debe > 0 ? decimal(r.debe) : "", r.haber > 0 ? decimal(r.haber) : ""]);
      }
      if (doc.y + ALTO_FILA > limite()) {
        doc.addPage();
        doc.y = MARGEN;
        titulos();
      }
      dibujarFila(doc, columnas, [`Total ${centro.centro_costo}`, "", "", decimal(centro.total_debe), decimal(centro.total_haber)], {
        negrita: true,
        fondo: COLOR.fondo,
      });
    }
    if (doc.y + ALTO_FILA > limite()) {
      doc.addPage();
      doc.y = MARGEN;
      titulos();
    }
    dibujarFila(doc, columnas, ["TOTAL GENERAL", "", "", decimal(reporte.totales.total_debe), decimal(reporte.totales.total_haber)], {
      negrita: true,
    });

    dibujarPies(doc);
    doc.end();
  });
}

module.exports = { aCsv, aPdf };
