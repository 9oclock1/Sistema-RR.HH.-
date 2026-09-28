import multer from "multer";

export const errorHandler = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const maxMb = process.env.MAX_FILE_SIZE_MB || 5;
      return res.status(400).json({
        success: false,
        error: "LIMIT_FILE_SIZE",
        message: `El archivo supera el tamaño máximo permitido de ${maxMb}MB.`,
      });
    }
    return res.status(400).json({
      success: false,
      error: err.code,
      message: err.message,
    });
  }

  if (err.code === "INVALID_FILE_TYPE") {
    return res.status(400).json({
      success: false,
      error: "INVALID_FILE_TYPE",
      message: err.message,
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  return res.status(statusCode).json({
    success: false,
    error:
      err.code ||
      (statusCode === 500 ? "INTERNAL_SERVER_ERROR" : "ERROR_SOLICITUD"),
    message: err.message || "Error interno del servidor.",
  });
};
