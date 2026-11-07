const fs = require('node:fs');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const multer = require('multer');
const HttpError = require('../utils/HttpError');
const { MAX_MB } = require('./evidenciaUpload');

const CARPETA_CONTRATOS = process.env.CONTRATOS_DIR || 'uploads/contratos';
const DIRECTORIO_CONTRATOS = path.resolve(process.cwd(), CARPETA_CONTRATOS);
const MAX_NOMBRE = 255;

const FORMATOS = {
  'application/pdf': { extension: '.pdf', esValido: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/jpeg': { extension: '.jpg', esValido: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: '.png', esValido: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
};

const errorDocumento = (mensaje) =>
  new HttpError(400, mensaje, { campos_faltantes: [], errores: [{ campo: 'documento', mensaje }] });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(DIRECTORIO_CONTRATOS, { recursive: true }, (error) => cb(error, DIRECTORIO_CONTRATOS));
  },
  filename: (req, file, cb) => cb(null, `${randomUUID()}${FORMATOS[file.mimetype].extension}`),
});

const fileFilter = (req, file, cb) => {
  if (FORMATOS[file.mimetype]) return cb(null, true);
  return cb(errorDocumento('Formato de documento no permitido. Solo se aceptan archivos PDF, JPG o PNG.'));
};

const recibirDocumento = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
}).single('documento');

const descartarDocumento = async (ruta) => {
  try {
    await fs.promises.unlink(ruta);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo eliminar el documento descartado', error);
  }
};

const leerCabecera = async (ruta) => {
  const archivo = await fs.promises.open(ruta, 'r');
  try {
    const cabecera = Buffer.alloc(8);
    const { bytesRead } = await archivo.read(cabecera, 0, cabecera.length, 0);
    return cabecera.subarray(0, bytesRead);
  } finally {
    await archivo.close();
  }
};

const calcularHash = async (ruta) => {
  const hash = createHash('sha256');
  await pipeline(fs.createReadStream(ruta), hash);
  return hash.digest('hex');
};

const verificarContenido = async (req, res, next) => {
  if (!req.file) return next();

  const cabecera = await leerCabecera(req.file.path);
  if (!FORMATOS[req.file.mimetype].esValido(cabecera)) {
    await descartarDocumento(req.file.path);
    throw errorDocumento('El contenido del archivo no corresponde a un PDF o imagen válida.');
  }
  req.file.hashSha256 = await calcularHash(req.file.path);
  return next();
};

const documentoContratoUpload = [recibirDocumento, verificarContenido];

const nombreOriginal = (archivo) => {
  const nombre = Buffer.from(archivo.originalname, 'latin1').toString('utf8');
  return (nombre.includes('�') ? archivo.originalname : nombre).slice(-MAX_NOMBRE);
};

const datosDocumento = (archivo) => ({
  documento_adjunto_url: `/${path.posix.join(CARPETA_CONTRATOS.replace(/\\/g, '/'), archivo.filename)}`,
  documento_nombre_original: nombreOriginal(archivo),
  documento_tipo_mime: archivo.mimetype,
  documento_tamano_bytes: archivo.size,
  documento_hash_sha256: archivo.hashSha256,
});

const rutaEnDisco = (url) => {
  const ruta = path.resolve(process.cwd(), url.replace(/^\/+/, ''));
  return ruta.startsWith(`${DIRECTORIO_CONTRATOS}${path.sep}`) ? ruta : null;
};

module.exports = { documentoContratoUpload, datosDocumento, descartarDocumento, rutaEnDisco };
