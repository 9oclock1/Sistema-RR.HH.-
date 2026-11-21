const multer = require("multer");
const { ErrorApp } = require("../utils/errores");
const { TIPOS_RESPALDO } = require("../utils/desvinculaciones");

const MAX_MB = 5;

const errorArchivo = (estado, mensaje) => new ErrorApp(estado, mensaje, [{ campo: "documento", mensaje }]);

const subida = multer({
  storage: multer.memoryStorage(),
  // Nombres de archivo con tildes o eñes.
  defParamCharset: "utf8",
  limits: { fileSize: MAX_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 4 * 1024 },
  fileFilter: (req, archivo, cb) => {
    if (!TIPOS_RESPALDO.includes(archivo.mimetype)) {
      return cb(errorArchivo(400, `«${archivo.originalname}» no está permitido. Solo se aceptan PDF, JPG o PNG.`));
    }
    cb(null, true);
  },
}).single("documento");

const MENSAJES = {
  LIMIT_FILE_SIZE: [413, `El documento de respaldo puede pesar hasta ${MAX_MB} MB.`],
  LIMIT_FILE_COUNT: [400, "Solo puede adjuntar un documento de respaldo."],
  LIMIT_UNEXPECTED_FILE: [400, "Adjunte un solo documento de respaldo en el campo «documento»."],
};

// Documento de respaldo en memoria (req.file); los errores de multer salen con el formato del servicio.
module.exports = (req, res, next) => {
  if (!req.is("multipart/form-data")) {
    return next(errorArchivo(400, "Envíe el formulario como multipart/form-data con el documento de respaldo."));
  }
  subida(req, res, (error) => {
    if (!error) return next();
    if (error instanceof ErrorApp) return next(error);
    if (error.name === "MulterError") {
      const [estado, mensaje] = MENSAJES[error.code] ?? [400, "No se pudo procesar el documento adjunto."];
      return next(errorArchivo(estado, mensaje));
    }
    next(errorArchivo(400, "No se pudo leer el formulario enviado."));
  });
};

module.exports.MAX_MB = MAX_MB;
