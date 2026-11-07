const multer = require("multer");
const { ErrorApp } = require("../utils/errores");
const { ADJUNTOS } = require("../utils/quejas");

const errorArchivo = (estado, mensaje) => new ErrorApp(estado, mensaje, [{ campo: "archivos", mensaje }]);

const subida = multer({
  storage: multer.memoryStorage(),
  defParamCharset: "utf8",
  limits: {
    fileSize: ADJUNTOS.MAX_BYTES,
    files: ADJUNTOS.MAX_ARCHIVOS,
    fields: 10,
    fieldSize: 32 * 1024,
  },
  fileFilter: (req, archivo, cb) => {
    if (!Object.hasOwn(ADJUNTOS.TIPOS, archivo.mimetype)) {
      return cb(errorArchivo(400, `«${archivo.originalname}» no está permitido. Solo se aceptan PDF, JPG o PNG.`));
    }
    cb(null, true);
  },
}).array("archivos", ADJUNTOS.MAX_ARCHIVOS);

const MENSAJES = {
  LIMIT_FILE_SIZE: [413, `Cada archivo puede pesar hasta ${ADJUNTOS.MAX_MB} MB.`],
  LIMIT_FILE_COUNT: [400, `Puede adjuntar hasta ${ADJUNTOS.MAX_ARCHIVOS} archivos.`],
  LIMIT_UNEXPECTED_FILE: [400, `Puede adjuntar hasta ${ADJUNTOS.MAX_ARCHIVOS} archivos en el campo «archivos».`],
  LIMIT_FIELD_VALUE: [400, "Uno de los campos del formulario es demasiado largo."],
};

module.exports = (req, res, next) => {
  if (!req.is("multipart/form-data")) return next();
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
