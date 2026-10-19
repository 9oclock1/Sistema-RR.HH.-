const multer = require("multer");
const { ErrorApp } = require("../utils/errores");
const { TIPOS_ADJUNTO } = require("../utils/justificaciones");

const MAX_MB = 5;
const MAX_ARCHIVOS = 3;

const errorArchivo = (estado, mensaje) => new ErrorApp(estado, mensaje, [{ campo: "archivos", mensaje }]);

const subida = multer({
  storage: multer.memoryStorage(),
  // Nombres de archivo con tildes o eñes.
  defParamCharset: "utf8",
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_ARCHIVOS, fields: 10, fieldSize: 4 * 1024 },
  fileFilter: (req, archivo, cb) => {
    if (!Object.hasOwn(TIPOS_ADJUNTO, archivo.mimetype)) {
      return cb(errorArchivo(400, `«${archivo.originalname}» no está permitido. Solo se aceptan PDF, JPG o PNG.`));
    }
    cb(null, true);
  },
}).array("archivos", MAX_ARCHIVOS);

const MENSAJES = {
  LIMIT_FILE_SIZE: [413, `Cada archivo puede pesar hasta ${MAX_MB} MB.`],
  LIMIT_FILE_COUNT: [400, `Puede adjuntar hasta ${MAX_ARCHIVOS} archivos.`],
  LIMIT_UNEXPECTED_FILE: [400, `Puede adjuntar hasta ${MAX_ARCHIVOS} archivos en el campo «archivos».`],
};

// Comprobantes en memoria (req.files); los errores de multer salen con el formato del servicio.
module.exports = (req, res, next) => {
  if (!req.is("multipart/form-data")) {
    return next(errorArchivo(400, "Envíe el formulario como multipart/form-data con los comprobantes."));
  }
  subida(req, res, (error) => {
    if (!error) return next();
    if (error instanceof ErrorApp) return next(error);
    if (error.name === "MulterError") {
      const [estado, mensaje] = MENSAJES[error.code] ?? [400, "No se pudo procesar el archivo adjunto."];
      return next(errorArchivo(estado, mensaje));
    }
    next(errorArchivo(400, "No se pudo leer el formulario enviado."));
  });
};

module.exports.MAX_MB = MAX_MB;
module.exports.MAX_ARCHIVOS = MAX_ARCHIVOS;
