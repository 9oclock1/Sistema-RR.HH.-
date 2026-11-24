const PDFDocument = require("pdfkit");
const { montoEnLetras, textoTiempoServicio } = require("../utils/finiquitos");

// RF-58 (KAN-78, AC2): documento oficial de finiquito para firma y revisión legal.
const MEMBRETE = {
  institucion: process.env.INSTITUCION_NOMBRE || "Sistema de Recursos Humanos",
  unidad: process.env.INSTITUCION_UNIDAD || "Gerencia de Recursos Humanos",
};

const COLOR = {
  primario: "#1868DB",
  texto: "#292A2E",
  secundario: "#505258",
  borde: "#DDDEE1",
  fondo: "#F8F8F8",
  resalte: "#E9F2FE",
};
const FUENTE = { normal: "Helvetica", negrita: "Helvetica-Bold" };
const MARGEN = 36;
const ALTO_PIE = 24;
const ALTO_TITULO = 18;
const ALTO_RENGLON = 26;
const ALTO_TOTAL = 22;
const ALTO_FIRMAS = 66;

const bs = (valor) =>
  `Bs ${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fechaCorta = (fecha) => {
  if (!fecha) return "—";
  const texto = fecha instanceof Date ? fecha.toISOString().slice(0, 10) : String(fecha).slice(0, 10);
  const [anio, mes, dia] = texto.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : texto;
};

const fechaHora = (valor) => {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(valor));
};

const anchoUtil = (doc) => doc.page.width - MARGEN * 2;
const limite = (doc) => doc.page.height - MARGEN - ALTO_PIE - 8;

function espacio(doc, y, alto) {
  if (y + alto <= limite(doc)) return y;
  doc.addPage();
  return MARGEN;
}

function dibujarEncabezado(doc, finiquito) {
  const y = MARGEN;
  doc.font(FUENTE.negrita).fontSize(14).fillColor(COLOR.primario).text(MEMBRETE.institucion, MARGEN, y, { lineBreak: false });
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text(MEMBRETE.unidad, MARGEN, y + 18, { lineBreak: false });
  doc.font(FUENTE.negrita).fontSize(13).fillColor(COLOR.texto).text("FINIQUITO", MARGEN, y, { width: anchoUtil(doc), align: "right" });
  doc.font(FUENTE.negrita).fontSize(9.5).fillColor(COLOR.primario)
    .text(`N.º ${finiquito.numero_documento}`, MARGEN, y + 18, { width: anchoUtil(doc), align: "right" });
  doc.moveTo(MARGEN, y + 38).lineTo(doc.page.width - MARGEN, y + 38).lineWidth(1).strokeColor(COLOR.primario).stroke();
  doc.y = y + 48;
}

function dibujarDatos(doc, proceso, finiquito) {
  const tiempo = textoTiempoServicio(finiquito.anios_servicio, finiquito.meses_servicio, finiquito.dias_fraccion);
  const datos = [
    ["Colaborador", proceso.nombre_empleado],
    ["Causal de desvinculación", proceso.causal_nombre ?? proceso.causal?.nombre ?? finiquito.codigo_causal],
    ["Fecha de ingreso", fechaCorta(proceso.fecha_ingreso)],
    ["Fecha de retiro", fechaCorta(finiquito.fecha_retiro)],
    ["Tiempo de servicio", tiempo],
    ["Sueldo promedio indemnizable", bs(finiquito.promedio_base)],
  ];
  const anchoColumna = anchoUtil(doc) / 2;
  const inicio = doc.y;
  datos.forEach(([etiqueta, valor], i) => {
    const x = MARGEN + (i % 2) * anchoColumna;
    const y = inicio + Math.floor(i / 2) * 26;
    doc.font(FUENTE.normal).fontSize(7.5).fillColor(COLOR.secundario).text(etiqueta, x, y, { width: anchoColumna - 12, lineBreak: false });
    doc.font(FUENTE.negrita).fontSize(9).fillColor(COLOR.texto)
      .text(String(valor), x, y + 10, { width: anchoColumna - 12, lineBreak: false, ellipsis: true });
  });
  doc.y = inicio + Math.ceil(datos.length / 2) * 26 + 8;
}

function dibujarTabla(doc, titulo, renglones, etiquetaTotal, total, vacio) {
  const ancho = anchoUtil(doc);
  const anchoImporte = 110;
  let y = espacio(doc, doc.y + 4, ALTO_TITULO + ALTO_RENGLON + ALTO_TOTAL);

  doc.rect(MARGEN, y, ancho, ALTO_TITULO).fill(COLOR.fondo);
  doc.font(FUENTE.negrita).fontSize(8.5).fillColor(COLOR.secundario).text(titulo, MARGEN + 6, y + 5, { lineBreak: false });
  doc.text("Importe", MARGEN, y + 5, { width: ancho - 6, align: "right", lineBreak: false });
  y += ALTO_TITULO;

  if (renglones.length === 0) {
    doc.font(FUENTE.normal).fontSize(8.5).fillColor(COLOR.secundario).text(vacio, MARGEN + 6, y + 6, { lineBreak: false });
    y += 22;
  } else {
    for (const r of renglones) {
      y = espacio(doc, y, ALTO_RENGLON);
      doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.texto)
        .text(r.concepto, MARGEN + 6, y + 4, { width: ancho - anchoImporte - 12, lineBreak: false, ellipsis: true });
      doc.text(bs(r.monto), MARGEN, y + 4, { width: ancho - 6, align: "right", lineBreak: false });
      if (r.detalle) {
        doc.font(FUENTE.normal).fontSize(7.5).fillColor(COLOR.secundario)
          .text(r.detalle, MARGEN + 6, y + 15, { width: ancho - anchoImporte - 12, lineBreak: false, ellipsis: true });
      }
      y += ALTO_RENGLON;
      doc.moveTo(MARGEN, y).lineTo(MARGEN + ancho, y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
    }
  }

  y = espacio(doc, y, ALTO_TOTAL);
  doc.font(FUENTE.negrita).fontSize(9).fillColor(COLOR.texto).text(etiquetaTotal, MARGEN + 6, y + 6, { lineBreak: false });
  doc.text(bs(total), MARGEN, y + 6, { width: ancho - 6, align: "right", lineBreak: false });
  doc.y = y + ALTO_TOTAL + 4;
}

function dibujarLiquido(doc, finiquito) {
  const y = espacio(doc, doc.y + 4, 62);
  const ancho = anchoUtil(doc);
  doc.rect(MARGEN, y, ancho, 46).fill(COLOR.resalte);
  doc.font(FUENTE.negrita).fontSize(11).fillColor(COLOR.texto)
    .text("Líquido pagable", MARGEN + 10, y + 10, { lineBreak: false });
  doc.fillColor(COLOR.primario)
    .text(bs(finiquito.liquido_pagable), MARGEN, y + 10, { width: ancho - 10, align: "right", lineBreak: false });
  doc.font(FUENTE.normal).fontSize(8.5).fillColor(COLOR.texto)
    .text(`Son: ${montoEnLetras(finiquito.liquido_pagable)}`, MARGEN + 10, y + 28, { width: ancho - 20, lineBreak: false, ellipsis: true });
  doc.y = y + 54;
}

function dibujarAprobacion(doc, finiquito, aprobadorNombre) {
  const y = espacio(doc, doc.y + 4, 30);
  const quien = aprobadorNombre || (finiquito.aprobado_por ? `ID ${finiquito.aprobado_por}` : "Administrador de RR.HH.");
  doc.font(FUENTE.normal).fontSize(8.5).fillColor(COLOR.secundario)
    .text(`Aprobado el ${fechaHora(finiquito.aprobado_en)} por ${quien}.`, MARGEN, y, { width: anchoUtil(doc) });
  doc.y = y + 20;
}

function dibujarFirmas(doc, nombreColaborador) {
  const ancho = anchoUtil(doc);
  const anchoFirma = (ancho - 40) / 3;
  const y = espacio(doc, doc.y + ALTO_FIRMAS - 20, 32);
  const etiquetas = [
    ["Colaborador", nombreColaborador],
    ["Administrador de RR.HH.", "Vo.Bo. Recursos Humanos"],
    ["Contador", "Vo.Bo. Contabilidad / Planillas"],
  ];

  etiquetas.forEach(([cargo, sub], i) => {
    const x = MARGEN + i * (anchoFirma + 20);
    doc.moveTo(x, y).lineTo(x + anchoFirma, y).lineWidth(0.5).strokeColor(COLOR.secundario).stroke();
    doc.font(FUENTE.negrita).fontSize(8).fillColor(COLOR.texto)
      .text(cargo, x, y + 6, { width: anchoFirma, align: "center", lineBreak: false });
    doc.font(FUENTE.normal).fontSize(7).fillColor(COLOR.secundario)
      .text(sub, x, y + 17, { width: anchoFirma, align: "center", lineBreak: false, ellipsis: true });
  });
}

function dibujarPies(doc, finiquito) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i += 1) {
    doc.switchToPage(i);
    doc.page.margins.bottom = 0;
    const y = doc.page.height - MARGEN - ALTO_PIE;
    doc.moveTo(MARGEN, y).lineTo(doc.page.width - MARGEN, y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
    doc.font(FUENTE.normal).fontSize(7).fillColor(COLOR.secundario)
      .text(`Documento oficial ${finiquito.numero_documento} · Emitido por ${MEMBRETE.unidad}`, MARGEN, y + 7, { lineBreak: false });
    doc.text(`Página ${i + 1} de ${count}`, MARGEN, y + 7, { width: anchoUtil(doc), align: "right", lineBreak: false });
  }
}

const nombreArchivo = (finiquito) => `finiquito-${finiquito.numero_documento}.pdf`;

function aPdf({ proceso, finiquito, aprobadorNombre = null }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: MARGEN,
      bufferPages: true,
      info: {
        Title: `Finiquito ${finiquito.numero_documento}`,
        Author: MEMBRETE.institucion,
        Subject: proceso.nombre_empleado,
      },
    });
    const partes = [];
    doc.on("data", (parte) => partes.push(parte));
    doc.on("end", () => resolve({ nombre_archivo: nombreArchivo(finiquito), contenido: Buffer.concat(partes) }));
    doc.on("error", reject);

    const ingresos = (finiquito.renglones ?? []).filter((r) => r.tipo === "INGRESO");
    const descuentos = (finiquito.renglones ?? []).filter((r) => r.tipo === "DESCUENTO");

    dibujarEncabezado(doc, finiquito);
    dibujarDatos(doc, proceso, finiquito);
    dibujarTabla(doc, "Ingresos y beneficios sociales", ingresos, "Total ingresos", finiquito.total_ingresos, "Sin ingresos registrados.");
    dibujarTabla(doc, "Descuentos", descuentos, "Total descuentos", finiquito.total_descuentos, "Sin descuentos registrados.");
    dibujarLiquido(doc, finiquito);
    dibujarAprobacion(doc, finiquito, aprobadorNombre);
    dibujarFirmas(doc, proceso.nombre_empleado);
    dibujarPies(doc, finiquito);
    doc.end();
  });
}

module.exports = { aPdf, nombreArchivo };
