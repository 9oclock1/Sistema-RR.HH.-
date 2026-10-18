const fs = require('node:fs');
const path = require('node:path');
const { finished } = require('node:stream/promises');
const PDFDocument = require('pdfkit');

const CARPETA_PDF = process.env.MEMORANDUMS_PDF_DIR || 'uploads/memorandums_pdf';
const DIRECTORIO_PDF = path.resolve(process.cwd(), CARPETA_PDF);

// RF-37 (criterio 3): formato institucional preconfigurado del memorándum.
const MEMBRETE = {
  institucion: process.env.INSTITUCION_NOMBRE || 'Sistema de Recursos Humanos',
  unidad: process.env.INSTITUCION_UNIDAD || 'Gerencia de Recursos Humanos',
  pie: process.env.INSTITUCION_PIE || '',
  logo: process.env.INSTITUCION_LOGO ? path.resolve(process.cwd(), process.env.INSTITUCION_LOGO) : null,
};

const CIERRE =
  'La presente llamada de atención queda registrada en su expediente personal (Kardex). Se le exhorta a corregir ' +
  'la conducta observada; la reincidencia podrá dar lugar a sanciones mayores conforme al reglamento interno.';

// Mismos tonos que DESIGN.md.
const COLOR = { primario: '#1868DB', texto: '#292A2E', secundario: '#505258', borde: '#DDDEE1', fondo: '#F8F8F8' };
const FUENTE = { normal: 'Helvetica', negrita: 'Helvetica-Bold' };
const MARGENES = { top: 112, bottom: 80, left: 64, right: 64 };
const ANCHO_ETIQUETA = 64;
const ALTO_FIRMAS = 120;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const NATURALEZAS = { OPERATIVA: 'Operativa', CONDUCTA: 'De conducta' };
const GRAVEDADES = { LEVE: 'Leve', MODERADA: 'Moderada', GRAVE: 'Grave' };

// 'AAAA-MM-DD' → '9 de octubre de 2026', sin pasar por Date para no depender de la zona horaria.
const fechaLarga = (fecha) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
};

// Los formularios multipart envían saltos CRLF y las fuentes estándar del PDF imprimen el retorno de carro como un símbolo.
const normalizarSaltos = (texto) => texto.replace(/\r\n?/g, '\n');

const anchoUtil = (doc) => doc.page.width - MARGENES.left - MARGENES.right;

const dibujarMembrete = (doc, memorandum) => {
  let x = MARGENES.left;
  if (MEMBRETE.logo && fs.existsSync(MEMBRETE.logo)) {
    doc.image(MEMBRETE.logo, x, 36, { fit: [48, 48] });
    x += 60;
  }

  doc.font(FUENTE.negrita).fontSize(14).fillColor(COLOR.primario).text(MEMBRETE.institucion, x, 42, { lineBreak: false });
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text(MEMBRETE.unidad, x, 62, { lineBreak: false });
  doc.font(FUENTE.negrita).fontSize(9).fillColor(COLOR.secundario)
    .text(memorandum.codigo_cite, MARGENES.left, 62, { width: anchoUtil(doc), align: 'right', lineBreak: false });

  doc.moveTo(MARGENES.left, 90).lineTo(doc.page.width - MARGENES.right, 90).lineWidth(2).strokeColor(COLOR.primario).stroke();
};

const dibujarPie = (doc, pagina, total) => {
  const y = doc.page.height - 52;
  // Sin margen inferior, pdfkit no abre una página nueva al escribir en el pie.
  doc.page.margins.bottom = 0;

  doc.moveTo(MARGENES.left, y).lineTo(doc.page.width - MARGENES.right, y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
  doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario);
  doc.text(MEMBRETE.pie, MARGENES.left, y + 8, { width: anchoUtil(doc) - 90, lineBreak: false });
  doc.text(`Página ${pagina} de ${total}`, MARGENES.left, y + 8, { width: anchoUtil(doc), align: 'right', lineBreak: false });
};

const dibujarTitulo = (doc, memorandum) => {
  const opciones = { width: anchoUtil(doc), align: 'center' };
  doc.font(FUENTE.negrita).fontSize(16).fillColor(COLOR.texto).text('MEMORÁNDUM', MARGENES.left, MARGENES.top, opciones);
  doc.font(FUENTE.normal).fontSize(10).fillColor(COLOR.secundario).text(memorandum.tipo_nombre.toUpperCase(), opciones);
  doc.moveDown(0.4);
  doc.font(FUENTE.negrita).fontSize(11).fillColor(COLOR.texto).text(`CITE: ${memorandum.codigo_cite}`, opciones);
  doc.moveDown(1.2);
};

const dibujarFila = (doc, etiqueta, valor, detalle) => {
  const y = doc.y;
  const x = MARGENES.left + ANCHO_ETIQUETA;
  const width = anchoUtil(doc) - ANCHO_ETIQUETA;

  doc.font(FUENTE.negrita).fontSize(10).fillColor(COLOR.texto).text(etiqueta, MARGENES.left, y, { width: ANCHO_ETIQUETA });
  doc.font(FUENTE.normal).fontSize(10).fillColor(COLOR.texto).text(valor, x, y, { width });
  if (detalle) doc.fontSize(9).fillColor(COLOR.secundario).text(detalle, x, doc.y + 1, { width });
  doc.moveDown(0.7);
};

const dibujarFalta = (doc, memorandum) => {
  const y = doc.y;
  const ancho = anchoUtil(doc);
  const columnas = [
    ['Naturaleza de la falta', NATURALEZAS[memorandum.naturaleza_falta]],
    ['Gravedad', GRAVEDADES[memorandum.gravedad_falta]],
  ];

  doc.rect(MARGENES.left, y, ancho, 44).fillAndStroke(COLOR.fondo, COLOR.borde);
  columnas.forEach(([etiqueta, valor], indice) => {
    const x = MARGENES.left + 12 + (ancho / 2) * indice;
    doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario).text(etiqueta.toUpperCase(), x, y + 9, { lineBreak: false });
    doc.font(FUENTE.negrita).fontSize(11).fillColor(COLOR.texto).text(valor, x, y + 22, { lineBreak: false });
  });

  doc.x = MARGENES.left;
  doc.y = y + 44 + 18;
};

const dibujarFirmas = (doc, memorandum) => {
  const limite = doc.page.height - MARGENES.bottom;
  if (doc.y + ALTO_FIRMAS > limite) doc.addPage();

  const ancho = (anchoUtil(doc) - 48) / 2;
  const y = Math.max(doc.y + 56, limite - ALTO_FIRMAS + 56);
  const firmas = [
    [memorandum.emisor_nombre, memorandum.emisor_cargo, 'Emitido por'],
    [memorandum.receptor_nombre, `C.I. ${memorandum.receptor_documento}`, 'Recibí conforme — Fecha: ____ / ____ / ______'],
  ];

  firmas.forEach(([nombre, detalle, rol], indice) => {
    const x = MARGENES.left + (ancho + 48) * indice;
    const opciones = { width: ancho, align: 'center' };

    doc.moveTo(x, y).lineTo(x + ancho, y).lineWidth(0.75).strokeColor(COLOR.texto).stroke();
    doc.font(FUENTE.negrita).fontSize(10).fillColor(COLOR.texto).text(nombre, x, y + 6, opciones);
    doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text(detalle, x, doc.y + 1, opciones);
    doc.fontSize(8).text(rol, x, doc.y + 1, opciones);
  });
};

const componer = (doc, memorandum) => {
  dibujarTitulo(doc, memorandum);

  dibujarFila(doc, 'A:', memorandum.receptor_nombre, `${memorandum.receptor_cargo} · ${memorandum.receptor_sucursal} · C.I. ${memorandum.receptor_documento}`);
  dibujarFila(doc, 'DE:', memorandum.emisor_nombre, memorandum.emisor_cargo);
  dibujarFila(doc, 'FECHA:', `${memorandum.receptor_ciudad}, ${fechaLarga(memorandum.fecha_emision)}`);
  dibujarFila(doc, 'REF.:', memorandum.asunto);

  doc.moveTo(MARGENES.left, doc.y).lineTo(doc.page.width - MARGENES.right, doc.y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
  doc.moveDown(1);
  dibujarFalta(doc, memorandum);

  const parrafo = { width: anchoUtil(doc), align: 'justify', lineGap: 3 };
  doc.font(FUENTE.normal).fontSize(10.5).fillColor(COLOR.texto).text(normalizarSaltos(memorandum.contenido_descripcion), MARGENES.left, doc.y, parrafo);
  doc.moveDown(1);
  doc.text(CIERRE, parrafo);

  if (memorandum.evidencia_adjunto_url) {
    doc.moveDown(1);
    doc.fontSize(9).fillColor(COLOR.secundario).text('Adj.: evidencia de respaldo registrada en el sistema.', { width: anchoUtil(doc) });
  }

  dibujarFirmas(doc, memorandum);
};

// `memorandum` es la fila de memorandumsModel.obtenerParaDocumento.
// Devuelve la ruta que se guarda en MEMORANDUMS.documento_pdf_url.
const generarPdfMemorandum = async (memorandum) => {
  await fs.promises.mkdir(DIRECTORIO_PDF, { recursive: true });

  const archivo = `${memorandum.codigo_cite}.pdf`;
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: MARGENES,
    bufferPages: true,
    info: { Title: `Memorándum ${memorandum.codigo_cite}`, Author: MEMBRETE.institucion, Subject: memorandum.asunto },
  });
  const destino = path.join(DIRECTORIO_PDF, archivo);
  const salida = fs.createWriteStream(destino);
  doc.pipe(salida);

  try {
    componer(doc, memorandum);

    // El membrete y el pie se dibujan al final para conocer el total de páginas.
    const { count } = doc.bufferedPageRange();
    for (let pagina = 0; pagina < count; pagina += 1) {
      doc.switchToPage(pagina);
      dibujarMembrete(doc, memorandum);
      dibujarPie(doc, pagina + 1, count);
    }

    doc.end();
    await finished(salida);
  } catch (error) {
    salida.destroy();
    await fs.promises.rm(destino, { force: true });
    throw error;
  }

  return `/${path.posix.join(CARPETA_PDF.replace(/\\/g, '/'), archivo)}`;
};

// Si la transacción del memorándum no se confirma, su PDF no debe quedar en disco.
const descartarPdf = async (rutaPdf) => {
  try {
    await fs.promises.unlink(path.join(DIRECTORIO_PDF, path.basename(rutaPdf)));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo eliminar el PDF descartado', error);
  }
};

module.exports = { generarPdfMemorandum, descartarPdf };
