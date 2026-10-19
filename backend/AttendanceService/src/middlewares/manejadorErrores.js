const { ErrorApp } = require("../utils/errores");
const { MAX_MB, MAX_ARCHIVOS } = require("./subirComprobantes");

module.exports = (err, req, res, next) => {
  if (err instanceof ErrorApp) {
    return res.status(err.estado).json({ error: err.message, detalles: err.detalles });
  }
  if (err.name === "MulterError") {
    const mensajes = {
      LIMIT_FILE_SIZE: [413, `Cada archivo puede pesar hasta ${MAX_MB} MB.`],
      LIMIT_FILE_COUNT: [400, `Puede adjuntar hasta ${MAX_ARCHIVOS} archivos.`],
      LIMIT_UNEXPECTED_FILE: [400, `Puede adjuntar hasta ${MAX_ARCHIVOS} archivos.`],
    };
    const [estado, mensaje] = mensajes[err.code] ?? [400, "No se pudo procesar el archivo adjunto."];
    return res.status(estado).json({ error: mensaje, detalles: [{ campo: "archivos", mensaje }] });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
};
