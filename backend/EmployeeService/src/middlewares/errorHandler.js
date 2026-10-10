const multer = require('multer');
const HttpError = require('../utils/HttpError');
const { MAX_MB } = require('./evidenciaUpload');

const MENSAJES_MULTER = {
  LIMIT_FILE_SIZE: `El archivo supera el tamaño máximo permitido de ${MAX_MB} MB.`,
  LIMIT_FILE_COUNT: 'Solo se admite un archivo adjunto.',
  LIMIT_UNEXPECTED_FILE: 'Campo de archivo no esperado.',
};

const errorHandler = (err, req, res, next) => {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.detalles });
  }

  if (err instanceof multer.MulterError) {
    const mensaje = MENSAJES_MULTER[err.code] || 'No se pudo procesar el archivo adjunto.';
    return res.status(400).json({ error: mensaje, campos_faltantes: [], errores: [{ campo: err.field || 'evidencia', mensaje }] });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la petición no es un JSON válido.' });
  }

  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Algún identificador enviado no es un UUID válido.', campos_faltantes: [], errores: [] });
  }

  if (err.code === '23503') {
    const [, campo, valor] = /Key \((\w+)\)=\(([^)]*)\)/.exec(err.detail || '') || [];
    const mensaje = campo ? `No existe un registro con ${campo} = ${valor}.` : 'Referencia a un registro inexistente.';
    return res.status(400).json({ error: mensaje, campos_faltantes: [], errores: campo ? [{ campo, mensaje }] : [] });
  }

  console.error(err);
  return res.status(500).json({ error: 'Error interno del servidor.' });
};

module.exports = errorHandler;
