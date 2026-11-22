const PDFDocument = require("pdfkit");

// RF-46 (criterio 2): boleta de pago en PDF con haberes, descuentos de ley, aportes y líquido pagable.

const MEMBRETE = {
  institucion: process.env.INSTITUCION_NOMBRE || "Sistema de Recursos Humanos",
  unidad: process.env.INSTITUCION_UNIDAD || "Gerencia de Recursos Humanos",
};

// Mismos tonos que DESIGN.md.
const COLOR = { primario: "#1868DB", texto: "#292A2E", secundario: "#505258", borde: "#DDDEE1", fondo: "#F8F8F8", resalte: "#E9F2FE" };
const FUENTE = { normal: "Helvetica", negrita: "Helvetica-Bold", mono: "Courier" };
const MARGEN = 36;
const ALTO_PIE = 28;
const ALTO_TITULO = 16;
const ALTO_RENGLON = 24;
const ALTO_TOTAL = 20;
const ALTO_FIRMAS = 52;

const numero = (valor, digitos = 2) =>
  Number(valor).toLocaleString("es-BO", { minimumFractionDigits: digitos, maximumFractionDigits: digitos });
const bs = (valor) => `Bs ${numero(valor)}`;
const porcentaje = (valor) => `${numero(valor, Number(valor) % 1 === 0 ? 0 : 2)} %`;
const mayuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);

const nombreMes = (periodo) =>
  new Intl.DateTimeFormat("es-BO", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${periodo}-01T00:00:00Z`));

const fechaHora = (valor) =>
  new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(valor));

// "12,71 % sobre Bs 3.976,67 · 27 de 30 días", igual que el detalle de la planilla.
function describir(r) {
  const valor = r.forma_calculo === "PORCENTAJE" ? porcentaje(r.valor) : bs(r.valor);
  const base = r.forma_calculo === "PORCENTAJE" && r.base !== null ? `${valor} sobre ${bs(r.base)}` : valor;
  return [base, r.detalle].filter(Boolean).join(" · ");
}

const anchoUtil = (doc) => doc.page.width - MARGEN * 2;

const limite = (doc) => doc.page.height - MARGEN - ALTO_PIE - 8;

// Abre una página nueva si lo que sigue no entra antes del pie. Devuelve la posición donde dibujar.
function espacio(doc, y, alto) {
  if (y + alto <= limite(doc)) return y;
  doc.addPage();
  return MARGEN;
}

const altoGrupo = (renglones) => 4 + ALTO_TITULO + (renglones.length ? renglones.length * ALTO_RENGLON : 22) + ALTO_TOTAL;

function dibujarEncabezado(doc, boleta) {
  const y = MARGEN;
  doc.font(FUENTE.negrita).fontSize(14).fillColor(COLOR.primario).text(MEMBRETE.institucion, MARGEN, y, { lineBreak: false });
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text(MEMBRETE.unidad, MARGEN, y + 20, { lineBreak: false });
  doc.font(FUENTE.negrita).fontSize(12).fillColor(COLOR.texto).text("BOLETA DE PAGO", MARGEN, y, { width: anchoUtil(doc), align: "right" });
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario)
    .text(`Sueldos y salarios de ${nombreMes(boleta.periodo)}`, MARGEN, y + 20, { width: anchoUtil(doc), align: "right" });
  doc.moveTo(MARGEN, y + 40).lineTo(doc.page.width - MARGEN, y + 40).lineWidth(1).strokeColor(COLOR.primario).stroke();
  doc.y = y + 48;
}

// Datos del colaborador en dos columnas de etiqueta y valor.
function dibujarDatos(doc, boleta) {
  const { empleado, contrato, dias } = boleta;
  const datos = [
    ["Colaborador", empleado.nombre_completo],
    ["Documento de identidad", empleado.numero_documento ?? "—"],
    ["Cargo", empleado.cargo ?? "—"],
    ["Área", empleado.area ?? "—"],
    ["Sucursal", empleado.sucursal ?? "—"],
    ["Contrato", contrato.numero_contrato],
    ["Haber mensual", bs(contrato.haber_mensual)],
    ["Días pagados", `${dias.pagados} de ${dias.contrato}`],
  ];
  const anchoColumna = anchoUtil(doc) / 2;
  const inicio = doc.y;
  datos.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + (i % 2) * anchoColumna;
    const y = inicio + Math.floor(i / 2) * 22;
    doc.font(FUENTE.normal).fontSize(7.5).fillColor(COLOR.secundario).text(etiqueta, x, y, { width: anchoColumna - 12, lineBreak: false });
    doc.font(FUENTE.negrita).fontSize(9).fillColor(COLOR.texto)
      .text(valor, x, y + 10, { width: anchoColumna - 12, lineBreak: false, ellipsis: true });
  });
  doc.y = inicio + Math.ceil(datos.length / 2) * 22 + 8;
}

// Renglones de un tipo con su total: concepto y descripción a la izquierda, importe a la derecha.
function dibujarGrupo(doc, titulo, renglones, etiquetaTotal, total, vacio) {
  const ancho = anchoUtil(doc);
  const anchoImporte = 110;
  // El título no queda solo al final de una página.
  let y = espacio(doc, doc.y + 4, ALTO_TITULO + ALTO_RENGLON + ALTO_TOTAL);
  doc.rect(MARGEN, y, ancho, ALTO_TITULO).fill(COLOR.fondo);
  doc.font(FUENTE.negrita).fontSize(8.5).fillColor(COLOR.secundario).text(titulo, MARGEN + 6, y + 4, { lineBreak: false });
  doc.text("Importe", MARGEN, y + 4, { width: ancho - 6, align: "right", lineBreak: false });
  y += ALTO_TITULO;
  if (renglones.length === 0) {
    doc.font(FUENTE.normal).fontSize(8.5).fillColor(COLOR.secundario).text(vacio, MARGEN + 6, y + 6, { lineBreak: false });
    y += 22;
  }
  for (const r of renglones) {
    y = espacio(doc, y, ALTO_RENGLON);
    doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.texto)
      .text(r.nombre, MARGEN + 6, y + 3, { width: ancho - anchoImporte - 12, lineBreak: false, ellipsis: true });
    doc.text(bs(r.resultado), MARGEN, y + 3, { width: ancho - 6, align: "right", lineBreak: false });
    doc.font(FUENTE.normal).fontSize(7.5).fillColor(COLOR.secundario)
      .text(describir(r), MARGEN + 6, y + 14, { width: ancho - anchoImporte - 12, lineBreak: false, ellipsis: true });
    y += ALTO_RENGLON;
    doc.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
  }
  y = espacio(doc, y, ALTO_TOTAL);
  doc.font(FUENTE.negrita).fontSize(9).fillColor(COLOR.texto).text(etiquetaTotal, MARGEN + 6, y + 5, { lineBreak: false });
  doc.text(bs(total), MARGEN, y + 5, { width: ancho - 6, align: "right", lineBreak: false });
  doc.y = y + ALTO_TOTAL;
}

function dibujarLiquido(doc, totales) {
  const y = espacio(doc, doc.y + 4, 50);
  const ancho = anchoUtil(doc);
  doc.rect(MARGEN, y, ancho, 34).fill(COLOR.resalte);
  doc.font(FUENTE.negrita).fontSize(11).fillColor(COLOR.texto).text("Líquido pagable", MARGEN + 10, y + 11, { lineBreak: false });
  doc.fillColor(COLOR.primario).text(bs(totales.liquido_pagable), MARGEN, y + 11, { width: ancho - 10, align: "right", lineBreak: false });
  doc.font(FUENTE.normal).fontSize(7.5).fillColor(COLOR.secundario)
    .text(`Total ganado ${bs(totales.total_ganado)} menos descuentos ${bs(totales.total_descuentos)}`, MARGEN, y + 40, { lineBreak: false });
  doc.y = y + 50;
}

function dibujarFirmas(doc) {
  const ancho = 180;
  const y = espacio(doc, doc.y + ALTO_FIRMAS - 20, 20);
  [MARGEN + 20, doc.page.width - MARGEN - 20 - ancho].forEach((x, i) => {
    doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.5).strokeColor(COLOR.secundario).stroke();
    doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario)
      .text(i === 0 ? "Firma del empleador" : "Recibí conforme", x, y + 6, { width: ancho, align: "center", lineBreak: false });
  });
}

function dibujarPies(doc, boleta) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i += 1) {
    doc.switchToPage(i);
    // Sin margen inferior, pdfkit no abre una página nueva al escribir en el pie.
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGEN - ALTO_PIE;
    doc.moveTo(MARGEN, y).lineTo(doc.page.width - MARGEN, y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
    doc.font(FUENTE.normal).fontSize(7).fillColor(COLOR.secundario)
      .text(`Emitida el ${fechaHora(boleta.emitida_en)} · Planilla cerrada el ${fechaHora(boleta.cerrada_en)}`, MARGEN, y + 6, { lineBreak: false });
    doc.text(`Página ${i + 1} de ${count}`, MARGEN, y + 6, { width: anchoUtil(doc), align: "right", lineBreak: false });
    doc.font(FUENTE.mono).fontSize(6.5)
      .text(`Código de verificación (SHA-256): ${boleta.codigo_verificacion}`, MARGEN, y + 17, { lineBreak: false });
  }
}

const nombreArchivo = (boleta) => `boleta-de-pago_${boleta.periodo}.pdf`;

function aPdf(boleta) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGEN,
      bufferPages: true,
      info: { Title: `Boleta de pago de ${nombreMes(boleta.periodo)}`, Author: MEMBRETE.institucion, Subject: boleta.empleado.nombre_completo },
    });
    const partes = [];
    doc.on("data", (parte) => partes.push(parte));
    doc.on("end", () => resolve({ nombre: nombreArchivo(boleta), contenido: Buffer.concat(partes) }));
    doc.on("error", reject);

    const { totales } = boleta;
    dibujarEncabezado(doc, boleta);
    dibujarDatos(doc, boleta);
    dibujarGrupo(doc, "Haberes", boleta.ingresos, "Total ganado", totales.total_ganado, "Sin haberes en el mes.");
    dibujarGrupo(doc, "Descuentos", boleta.descuentos, "Total descuentos", totales.total_descuentos, "Sin descuentos en el mes.");
    dibujarLiquido(doc, totales);
    // Las firmas no quedan solas en otra página: si no entran con los aportes, ambos pasan a la siguiente.
    if (doc.y + altoGrupo(boleta.aportes) + ALTO_FIRMAS > limite(doc) && MARGEN + altoGrupo(boleta.aportes) + ALTO_FIRMAS <= limite(doc)) {
      doc.addPage();
      doc.y = MARGEN - 4;
    }
    dibujarGrupo(
      doc,
      "Aportes patronales (a cargo del empleador, no se descuentan)",
      boleta.aportes,
      "Total aportes patronales",
      totales.total_aportes,
      "Sin aportes patronales en el mes."
    );
    dibujarFirmas(doc);
    dibujarPies(doc, boleta);
    doc.end();
  });
}

module.exports = { aPdf, nombreMes: (periodo) => mayuscula(nombreMes(periodo)) };
