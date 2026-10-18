const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const multer = require('multer');
const HttpError = require('../utils/HttpError');

const CARPETA_EVIDENCIA = process.env.EVIDENCIA_DIR || 'uploads/evidencia';
const DIRECTORIO_EVIDENCIA = path.resolve(process.cwd(), CARPETA_EVIDENCIA);
const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5;

// La extensión sale del tipo declarado, nunca del nombre original que manda el cliente.
const EXTENSIONES = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(DIRECTORIO_EVIDENCIA, { recursive: true }, (error) => cb(error, DIRECTORIO_EVIDENCIA));
  },
  filename: (req, file, cb) => cb(null, `${randomUUID()}${EXTENSIONES[file.mimetype]}`),
});

const fileFilter = (req, file, cb) => {
  if (EXTENSIONES[file.mimetype]) return cb(null, true);

  const mensaje = 'Formato de evidencia no permitido. Solo se aceptan archivos PDF, JPG o PNG.';
  return cb(new HttpError(400, mensaje, { campos_faltantes: [], errores: [{ campo: 'evidencia', mensaje }] }));
};

const evidenciaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1 },
}).single('evidencia');

// Ruta que se guarda en MEMORANDUMS.evidencia_adjunto_url.
const rutaEvidencia = (archivo) => `/${path.posix.join(CARPETA_EVIDENCIA.replace(/\\/g, '/'), archivo.filename)}`;

// Si el memorándum no llega a guardarse, el adjunto no debe quedar huérfano en disco.
const descartarEvidencia = async (archivo) => {
  try {
    await fs.promises.unlink(archivo.path);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('No se pudo eliminar la evidencia descartada', error);
  }
};

module.exports = { evidenciaUpload, rutaEvidencia, descartarEvidencia, MAX_MB };
