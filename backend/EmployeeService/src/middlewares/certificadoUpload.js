const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const HttpError = require('../utils/HttpError');
const { MAX_MB } = require('./evidenciaUpload');

const CARPETA_CERTIFICADOS = process.env.CERTIFICADOS_DIR || 'uploads/certificados';
const DIRECTORIO_CERTIFICADOS = path.resolve(process.cwd(), CARPETA_CERTIFICADOS);
const MAX_NOMBRE = 255;

const FORMATOS = {
  'application/pdf': { extension: '.pdf', esValido: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  'image/jpeg': { extension: '.jpg', esValido: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { extension: '.png', esValido: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  'image/webp': {
    extension: '.webp',
    esValido: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  },
};

const errorCertificado = (mensaje) =>
  new HttpError(400, mensaje, { campos_faltantes: [], errores: [{ campo: 'certificado', mensaje }] });

const MENSAJE_FORMATO = 'Formato de certificado no permitido. Solo se aceptan archivos PDF, JPG, PNG o WEBP.';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(DIRECTORIO_CERTIFICADOS, { recursive: true }, (error) => cb(error, DIRECTORIO_CERTIFICADOS));
  },
  filename: (req, file, cb) => cb(null, `${randomUUID()}${FORMATOS[file.mimetype].extension}`),
});

const fileFilter = (req, file, cb) => {
  if (FORMATOS[file.mimetype]) return cb(null, true);
  return cb(errorCertificado(MENSAJE_FORMATO));
};

const recibirCertificado = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
}).single('certificado');

const descartarCertificado = async (ruta) => {
  try {
    await fs.promises.unlink(ruta);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo eliminar el certificado descartado', error);
  }
};

const leerCabecera = async (ruta) => {
  const archivo = await fs.promises.open(ruta, 'r');
  try {
    const cabecera = Buffer.alloc(12);
    const { bytesRead } = await archivo.read(cabecera, 0, cabecera.length, 0);
    return cabecera.subarray(0, bytesRead);
  } finally {
    await archivo.close();
  }
};

const verificarContenido = async (req, res, next) => {
  if (!req.file) return next();

  const cabecera = await leerCabecera(req.file.path);
  if (!FORMATOS[req.file.mimetype].esValido(cabecera)) {
    await descartarCertificado(req.file.path);
    throw errorCertificado('El contenido del archivo no corresponde a un PDF o imagen válida.');
  }
  return next();
};

const certificadoUpload = [recibirCertificado, verificarContenido];

const nombreOriginal = (archivo) => {
  const nombre = Buffer.from(archivo.originalname, 'latin1').toString('utf8');
  return (nombre.includes('�') ? archivo.originalname : nombre).slice(-MAX_NOMBRE);
};

const datosCertificado = (archivo) => ({
  certificado_adjunto_url: `/${path.posix.join(CARPETA_CERTIFICADOS.replace(/\\/g, '/'), archivo.filename)}`,
  certificado_nombre_original: nombreOriginal(archivo),
  certificado_tipo_mime: archivo.mimetype,
  certificado_tamano_bytes: archivo.size,
});

const rutaEnDisco = (url) => {
  const ruta = path.resolve(process.cwd(), url.replace(/^\/+/, ''));
  return ruta.startsWith(`${DIRECTORIO_CERTIFICADOS}${path.sep}`) ? ruta : null;
};

module.exports = { certificadoUpload, datosCertificado, descartarCertificado, rutaEnDisco };
