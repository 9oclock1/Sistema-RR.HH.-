const multer = require("multer");
const { ErrorApp } = require("../utils/errores");
const { EXTENSIONES } = require("../utils/almacenamiento");

const MAX_MB = parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 5;
const MAX_ARCHIVOS = 5;

const subida = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_MB * 1024 * 1024, files: MAX_ARCHIVOS },
  fileFilter: (req, archivo, cb) => {
    if (!Object.hasOwn(EXTENSIONES, archivo.mimetype)) {
      return cb(new ErrorApp(400, "Formato no permitido. Solo se aceptan archivos PDF, JPG o PNG."));
    }
    cb(null, true);
  },
});

module.exports = { subirComprobantes: subida.array("archivos", MAX_ARCHIVOS), MAX_MB, MAX_ARCHIVOS };
