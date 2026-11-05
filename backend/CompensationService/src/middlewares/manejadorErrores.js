const { ErrorApp } = require("../utils/errores");

module.exports = (err, req, res, next) => {
  if (err instanceof ErrorApp) {
    return res.status(err.estado).json({ error: err.message, detalles: err.detalles });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido" });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
};
