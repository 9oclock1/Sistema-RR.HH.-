const { ErrorApp } = require("../utils/errores");

module.exports = (err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }

  if (err instanceof ErrorApp) {
    return res.status(err.estado).json({
      success: false,
      error: err.message,
      message: err.message,
      detalles: err.detalles,
      errors: Array.isArray(err.detalles) ? err.detalles : undefined,
    });
  }

  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    const msg = "El cuerpo de la solicitud no es JSON válido.";
    return res.status(400).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  if (err.type === "entity.too.large") {
    const msg = "El cuerpo de la solicitud es demasiado grande.";
    return res.status(413).json({
      success: false,
      error: msg,
      message: msg,
    });
  }

  console.error("[RecruitmentService Error]", err);
  const status = err.statusCode || err.status || 500;
  const msg = status === 500 ? "Error interno del servidor." : (err.message || "Error interno del servidor.");
  res.status(status).json({
    success: false,
    error: msg,
    message: msg,
  });
};
