const sharp = require("sharp");
const { PDFDocument, PDFDict, PDFName, PDFRef, EncryptedPDFError } = require("pdf-lib");
const { ErrorApp } = require("./errores");

const FORMATO_IMAGEN = { "image/jpeg": "jpeg", "image/png": "png" };
const CLAVES_METADATOS = ["Metadata", "PieceInfo"].map((clave) => PDFName.of(clave));
const TIPO = PDFName.of("Type");
const ANOTACION = PDFName.of("Annot");
const AUTOR_ANOTACION = PDFName.of("T");

const archivoInvalido = (nombre, mensaje) =>
  new ErrorApp(400, mensaje, [{ campo: "archivos", mensaje, archivo: nombre }]);

async function limpiarImagen(buffer, tipo, nombre) {
  let imagen;
  try {
    imagen = sharp(buffer, { failOn: "error" });
    const { format } = await imagen.metadata();
    if (format !== FORMATO_IMAGEN[tipo]) throw new Error("formato distinto");
  } catch {
    throw archivoInvalido(nombre, `«${nombre}» no es una imagen ${tipo === "image/png" ? "PNG" : "JPG"} válida.`);
  }
  const orientada = imagen.rotate();
  return tipo === "image/png" ? orientada.png().toBuffer() : orientada.jpeg({ quality: 90 }).toBuffer();
}

const diccionarioDe = (objeto) =>
  objeto instanceof PDFDict ? objeto : objeto?.dict instanceof PDFDict ? objeto.dict : null;

async function limpiarPdf(buffer, nombre) {
  if (buffer.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw archivoInvalido(nombre, `«${nombre}» no es un PDF válido.`);
  }
  let documento;
  try {
    documento = await PDFDocument.load(buffer, { updateMetadata: false });
  } catch (error) {
    const mensaje =
      error instanceof EncryptedPDFError
        ? `«${nombre}» está protegido con contraseña. Adjunte una copia sin protección.`
        : `«${nombre}» no es un PDF válido.`;
    throw archivoInvalido(nombre, mensaje);
  }

  const { context } = documento;
  const huerfanos = [];
  if (context.trailerInfo.Info instanceof PDFRef) huerfanos.push(context.trailerInfo.Info);
  context.trailerInfo.Info = undefined;
  context.trailerInfo.ID = undefined;

  for (const [, objeto] of context.enumerateIndirectObjects()) {
    const diccionario = diccionarioDe(objeto);
    if (!diccionario) continue;
    for (const clave of CLAVES_METADATOS) {
      const valor = diccionario.get(clave);
      if (valor instanceof PDFRef) huerfanos.push(valor);
      diccionario.delete(clave);
    }
    if (diccionario.get(TIPO) === ANOTACION) diccionario.delete(AUTOR_ANOTACION);
  }
  huerfanos.forEach((referencia) => context.delete(referencia));

  return Buffer.from(await documento.save());
}

async function limpiarAdjunto({ buffer, mimetype, originalname }) {
  return mimetype === "application/pdf"
    ? limpiarPdf(buffer, originalname)
    : limpiarImagen(buffer, mimetype, originalname);
}

module.exports = { limpiarAdjunto };
