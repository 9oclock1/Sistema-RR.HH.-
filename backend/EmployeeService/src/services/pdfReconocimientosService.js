const fs = require('node:fs');
const path = require('node:path');
const { finished } = require('node:stream/promises');
const PDFDocument = require('pdfkit');
const { MEMBRETE, FUENTE, fechaLarga, normalizarSaltos } = require('./pdfGeneratorService');

const CARPETA_PDF = process.env.RECONOCIMIENTOS_PDF_DIR || 'uploads/reconocimientos_pdf';
const DIRECTORIO_PDF = path.resolve(process.cwd(), CARPETA_PDF);

// RF-38 (criterio 3): formato institucional de reconocimiento, distinto al de la llamada de atención.
const TITULO = 'RECONOCIMIENTO INSTITUCIONAL';
const SUBTITULO = 'MEMORÁNDUM DE FELICITACIÓN';
const DISTINTIVO = 'DESEMPEÑO DESTACADO';

const CIERRE =
  'El presente reconocimiento queda registrado en su expediente personal (Kardex) como antecedente favorable para ' +
  'futuras evaluaciones de desempeño y promociones. La institución agradece su compromiso y le extiende sus más ' +
  'sinceras felicitaciones.';

// Mismos tonos que DESIGN.md; el dorado es el de advertencia, usado aquí solo como ornamento.
const COLOR = {
  primario: '#1868DB',
  dorado: '#E2B203',
  realce: '#E9F2FE',
  texto: '#292A2E',
  secundario: '#505258',
  borde: '#DDDEE1',
  blanco: '#FFFFFF',
};
const MARGENES = { top: 116, bottom: 84, left: 72, right: 72 };
const MARCO = 24;
const ALTO_CIERRE = 116;
const ANCHO_FIRMA = 220;

// Las fuentes estándar del PDF solo cubren WinAnsi: una tilde o una ñ escritas con caracteres
// combinantes (n + ~) no se imprimen si antes no se componen en un único carácter.
const textoSeguro = (texto) => normalizarSaltos(String(texto)).normalize('NFC');

const anchoUtil = (doc) => doc.page.width - MARGENES.left - MARGENES.right;
const centrado = (doc) => ({ width: anchoUtil(doc), align: 'center' });

const dibujarMarco = (doc) => {
  const { width, height } = doc.page;
  doc.rect(MARCO, MARCO, width - MARCO * 2, height - MARCO * 2).lineWidth(2).strokeColor(COLOR.dorado).stroke();
  doc.rect(MARCO + 5, MARCO + 5, width - (MARCO + 5) * 2, height - (MARCO + 5) * 2).lineWidth(0.5).strokeColor(COLOR.primario).stroke();
};

const dibujarMembrete = (doc, reconocimiento) => {
  let x = MARGENES.left;
  if (MEMBRETE.logo && fs.existsSync(MEMBRETE.logo)) {
    doc.image(MEMBRETE.logo, x, 44, { fit: [44, 44] });
    x += 56;
  }

  doc.font(FUENTE.negrita).fontSize(14).fillColor(COLOR.primario).text(MEMBRETE.institucion, x, 50, { lineBreak: false });
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text(MEMBRETE.unidad, x, 70, { lineBreak: false });
  doc.font(FUENTE.negrita).fontSize(9).fillColor(COLOR.secundario)
    .text(reconocimiento.codigo_cite, MARGENES.left, 70, { width: anchoUtil(doc), align: 'right', lineBreak: false });

  doc.moveTo(MARGENES.left, 96).lineTo(doc.page.width - MARGENES.right, 96).lineWidth(1.5).strokeColor(COLOR.dorado).stroke();
};

const dibujarPie = (doc, pagina, total) => {
  const y = doc.page.height - 62;
  // Sin margen inferior, pdfkit no abre una página nueva al escribir en el pie.
  doc.page.margins.bottom = 0;

  doc.moveTo(MARGENES.left, y).lineTo(doc.page.width - MARGENES.right, y).lineWidth(0.5).strokeColor(COLOR.borde).stroke();
  doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario);
  doc.text(MEMBRETE.pie, MARGENES.left, y + 8, { width: anchoUtil(doc) - 90, lineBreak: false });
  doc.text(`Página ${pagina} de ${total}`, MARGENES.left, y + 8, { width: anchoUtil(doc), align: 'right', lineBreak: false });
};

// La insignia se dibuja con vectores: las fuentes estándar no traen símbolos como la estrella.
const dibujarInsignia = (doc, cx, cy) => {
  const puntas = [];
  for (let i = 0; i < 10; i += 1) {
    const radio = i % 2 === 0 ? 12 : 5;
    const angulo = -Math.PI / 2 + (i * Math.PI) / 5;
    puntas.push([cx + radio * Math.cos(angulo), cy + radio * Math.sin(angulo)]);
  }

  doc.circle(cx, cy, 20).lineWidth(1.5).strokeColor(COLOR.dorado).stroke();
  doc.polygon(...puntas).fill(COLOR.dorado);
};

const dibujarDistintivo = (doc) => {
  doc.font(FUENTE.negrita).fontSize(11);
  const ancho = doc.widthOfString(DISTINTIVO) + 40;
  const x = (doc.page.width - ancho) / 2;
  const y = doc.y;

  doc.roundedRect(x, y, ancho, 24, 12).fill(COLOR.primario);
  doc.fillColor(COLOR.blanco).text(DISTINTIVO, x, y + 7, { width: ancho, align: 'center', lineBreak: false });
  doc.y = y + 24;
};

const dibujarTitulo = (doc, reconocimiento) => {
  dibujarInsignia(doc, doc.page.width / 2, MARGENES.top + 20);

  doc.font(FUENTE.negrita).fontSize(20).fillColor(COLOR.primario).text(TITULO, MARGENES.left, MARGENES.top + 50, centrado(doc));
  doc.font(FUENTE.normal).fontSize(10).fillColor(COLOR.secundario).text(SUBTITULO, MARGENES.left, doc.y + 2, centrado(doc));
  doc.moveDown(0.8);
  dibujarDistintivo(doc);

  doc.font(FUENTE.negrita).fontSize(11).fillColor(COLOR.texto).text(`CITE: ${reconocimiento.codigo_cite}`, MARGENES.left, doc.y + 12, centrado(doc));
  doc.font(FUENTE.normal).fontSize(10).fillColor(COLOR.secundario)
    .text(`${textoSeguro(reconocimiento.receptor_ciudad)}, ${fechaLarga(reconocimiento.fecha_emision)}`, MARGENES.left, doc.y + 2, centrado(doc));
  doc.moveDown(1.4);
};

const dibujarHomenajeado = (doc, reconocimiento) => {
  const detalle = `${reconocimiento.receptor_cargo} · ${reconocimiento.receptor_sucursal} · C.I. ${reconocimiento.receptor_documento}`;

  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text('SE OTORGA A', MARGENES.left, doc.y, centrado(doc));
  doc.font(FUENTE.negrita).fontSize(18).fillColor(COLOR.texto).text(textoSeguro(reconocimiento.receptor_nombre), MARGENES.left, doc.y + 4, centrado(doc));
  doc.font(FUENTE.normal).fontSize(10).fillColor(COLOR.secundario).text(textoSeguro(detalle), MARGENES.left, doc.y + 2, centrado(doc));
  doc.moveDown(1.4);
};

const dibujarMotivo = (doc, reconocimiento) => {
  const relleno = 14;
  const ancho = anchoUtil(doc);
  const x = MARGENES.left + relleno + 4;
  const width = ancho - relleno * 2 - 4;
  const asunto = textoSeguro(reconocimiento.asunto);

  const altoAsunto = doc.font(FUENTE.negrita).fontSize(12).heightOfString(asunto, { width });
  const alto = relleno + 12 + altoAsunto + 14 + relleno;
  const y = doc.y;

  doc.rect(MARGENES.left, y, ancho, alto).fill(COLOR.realce);
  doc.rect(MARGENES.left, y, 4, alto).fill(COLOR.dorado);
  doc.font(FUENTE.normal).fontSize(8).fillColor(COLOR.secundario).text('MOTIVO DEL RECONOCIMIENTO', x, y + relleno, { width, lineBreak: false });
  doc.font(FUENTE.negrita).fontSize(12).fillColor(COLOR.texto).text(asunto, x, y + relleno + 12, { width });
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text(textoSeguro(reconocimiento.tipo_nombre), x, doc.y + 3, { width, lineBreak: false });

  doc.x = MARGENES.left;
  doc.y = y + alto + 18;
};

// La felicitación y la firma van juntas: si no caben, pasan las dos a la página siguiente.
const dibujarCierre = (doc, reconocimiento) => {
  const limite = doc.page.height - MARGENES.bottom;
  if (doc.y + ALTO_CIERRE > limite) doc.addPage();
  else doc.moveDown(1);

  doc.font(FUENTE.negrita).fontSize(12).fillColor(COLOR.primario).text('¡Felicitaciones!', MARGENES.left, doc.y, centrado(doc));

  const x = (doc.page.width - ANCHO_FIRMA) / 2;
  const y = Math.max(doc.y + 36, limite - 52);
  const opciones = { width: ANCHO_FIRMA, align: 'center' };

  doc.moveTo(x, y).lineTo(x + ANCHO_FIRMA, y).lineWidth(0.75).strokeColor(COLOR.texto).stroke();
  doc.font(FUENTE.negrita).fontSize(10).fillColor(COLOR.texto).text(textoSeguro(reconocimiento.emisor_nombre), x, y + 6, opciones);
  doc.font(FUENTE.normal).fontSize(9).fillColor(COLOR.secundario).text(textoSeguro(reconocimiento.emisor_cargo), x, doc.y + 1, opciones);
  doc.fontSize(8).text('Otorgado por', x, doc.y + 1, opciones);
};

const componer = (doc, reconocimiento) => {
  dibujarTitulo(doc, reconocimiento);
  dibujarHomenajeado(doc, reconocimiento);
  dibujarMotivo(doc, reconocimiento);

  const parrafo = { width: anchoUtil(doc), align: 'justify', lineGap: 3 };
  doc.font(FUENTE.normal).fontSize(10.5).fillColor(COLOR.texto).text(textoSeguro(reconocimiento.contenido_descripcion), MARGENES.left, doc.y, parrafo);
  doc.moveDown(1);
  doc.text(CIERRE, parrafo);

  dibujarCierre(doc, reconocimiento);
};

// `reconocimiento` es la fila de memorandumsModel.obtenerParaDocumento.
// Devuelve la ruta que se guarda en MEMORANDUMS.documento_pdf_url.
const generarPdfReconocimiento = async (reconocimiento) => {
  await fs.promises.mkdir(DIRECTORIO_PDF, { recursive: true });

  const archivo = `${reconocimiento.codigo_cite}.pdf`;
  const doc = new PDFDocument({
    size: 'LETTER',
    margins: MARGENES,
    bufferPages: true,
    info: { Title: `Reconocimiento ${reconocimiento.codigo_cite}`, Author: MEMBRETE.institucion, Subject: textoSeguro(reconocimiento.asunto) },
  });
  const destino = path.join(DIRECTORIO_PDF, archivo);
  const salida = fs.createWriteStream(destino);
  doc.pipe(salida);

  try {
    componer(doc, reconocimiento);

    // El marco, el membrete y el pie se dibujan al final para conocer el total de páginas.
    const { count } = doc.bufferedPageRange();
    for (let pagina = 0; pagina < count; pagina += 1) {
      doc.switchToPage(pagina);
      dibujarMarco(doc);
      dibujarMembrete(doc, reconocimiento);
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

// Si la transacción del reconocimiento no se confirma, su PDF no debe quedar en disco.
const descartarPdf = async (rutaPdf) => {
  try {
    await fs.promises.unlink(path.join(DIRECTORIO_PDF, path.basename(rutaPdf)));
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo eliminar el PDF descartado', error);
  }
};

module.exports = { generarPdfReconocimiento, descartarPdf };
