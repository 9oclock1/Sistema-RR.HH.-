const { ErrorApp } = require("../utils/errores");

module.exports = (err, req, res, next) => {
  if (err instanceof ErrorApp || err.type === "entity.parse.failed") return next(err);
  console.error(`Error en ${req.method} ${req.baseUrl}${req.path}:`, err.code ?? err.name, err.message);
  res.status(500).json({ error: "No se pudo procesar la queja. Intente nuevamente." });
};
