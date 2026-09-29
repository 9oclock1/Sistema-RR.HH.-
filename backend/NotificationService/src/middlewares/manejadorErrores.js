const { ErrorApp } = require("../utils/errores");

module.exports = (err, req, res, next) => {
  if (err instanceof ErrorApp) {
    return res.status(err.estado).json({
      error: err.message,
      detalles: err.detalles || [],
    });
  }

  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "Formato JSON inválido en el cuerpo de la petición." });
  }

  // Errores de llave foránea o restricciones de PostgreSQL
  if (err.code === "23505") {
    return res.status(409).json({ error: "Ya existe un registro con los mismos datos especificados." });
  }

  if (err.code === "23503") {
    return res.status(422).json({ error: "Uno de los identificadores relacionados no existe en la base de datos." });
  }

  if (err.code === "22P02") {
    return res.status(400).json({ error: "Sintaxis de identificador UUID inválida." });
  }

  console.error("Error no controlado en NotificationService:", err);
  res.status(500).json({ error: "Error interno en el servicio de notificaciones y comunicaciones." });
};
