const { ErrorApp } = require("../utils/errores");

// Código de Postgres para "la tabla/relación no existe" (undefined_table). Pasa cuando el volumen de la
// base se creó antes de que una migración le agregara una tabla nueva (ver db/migraciones): sin este chequeo
// caía como un 500 genérico, sin ninguna pista de qué faltaba ni cómo arreglarlo.
const TABLA_INEXISTENTE = "42P01";

module.exports = (err, req, res, next) => {
  if (err instanceof ErrorApp) {
    return res.status(err.estado).json({ error: err.message, detalles: err.detalles, codigo: err.codigo });
  }
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "JSON inválido" });
  }
  if (err.code === TABLA_INEXISTENTE) {
    console.error("Falta una tabla en la base de datos:", err.message);
    return res.status(503).json({
      error:
        "Faltan tablas en la base de datos (la base es de antes de que se agregaran). Corra la migración " +
        "backend/CompensationService/db/migraciones/001_planilla_aguinaldos.sql contra la base, o recree el " +
        "volumen de Docker para que init.sql se ejecute de nuevo.",
    });
  }
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor" });
};
