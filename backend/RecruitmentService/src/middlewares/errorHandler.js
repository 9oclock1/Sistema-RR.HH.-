const multer = require('multer');
const HttpError = require('../utils/HttpError');
const { ErrorApp } = require('../utils/errores');

const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.detalles });
  }

  // Errores de postulantes (RF-09): mantienen su formato de respuesta.
  if (err instanceof ErrorApp) {
    return res.status(err.estado).json({
      success: false,
      error: err.message,
      message: err.message,
      detalles: err.detalles,
      errors: Array.isArray(err.detalles) ? err.detalles : undefined,
    });
  }

  // Errores de la carga de CV (RF-10): { success, error: código, message }.
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxMb = process.env.MAX_FILE_SIZE_MB || 5;
      return res.status(400).json({
        success: false,
        error: 'LIMIT_FILE_SIZE',
        message: `El archivo supera el tamaño máximo permitido de ${maxMb}MB.`,
      });
    }
    return res.status(400).json({ success: false, error: err.code, message: err.message });
  }

  if (err.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({ success: false, error: 'INVALID_FILE_TYPE', message: err.message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  }

  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'El cuerpo de la petición es demasiado grande.' });
  }

  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Algún identificador enviado no es un UUID válido.', campos_faltantes: [], errores: [] });
  }

  if (err.code === '23503') {
    const [, campo, valor] = /Key \((\w+)\)=\(([^)]*)\)/.exec(err.detail || '') || [];
    const mensaje = campo ? `No existe un registro con ${campo} = ${valor}.` : 'Referencia a un registro inexistente.';
    return res.status(400).json({ error: mensaje, campos_faltantes: [], errores: campo ? [{ campo, mensaje }] : [] });
  }

  // Errores con statusCode de la carga de CV (400, 404, 409).
  const statusCode = err.statusCode || err.status;
  if (statusCode && statusCode < 500) {
    return res.status(statusCode).json({ success: false, error: 'ERROR_SOLICITUD', message: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
};

module.exports = errorHandler;
