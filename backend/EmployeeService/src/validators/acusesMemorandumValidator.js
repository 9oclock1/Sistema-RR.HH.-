const { esVacio, invalido, cuerpoComoObjeto, normalizarTexto, lanzarSiHayErrores } = require('./comunes');

const ESTADOS_ACUSE = ['PENDIENTE', 'RECIBIDO', 'VENCIDO'];
const MAX_COMENTARIO = 2000;

// El descargo o comentario es opcional; un texto vacío equivale a no enviarlo.
const validarAcuse = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];
  const comentario = normalizarTexto(datos.comentario, 'comentario', { maxLength: MAX_COMENTARIO }, errores);
  lanzarSiHayErrores(errores);
  return { comentario };
};

// Filtro opcional ?estado_acuse= de la vista de seguimiento; devuelve null cuando no se envía.
const validarEstadoAcuse = (valor) => {
  if (esVacio(valor)) return null;

  const estado = typeof valor === 'string' ? valor.trim().toUpperCase() : null;
  if (!ESTADOS_ACUSE.includes(estado)) {
    lanzarSiHayErrores([
      invalido('estado_acuse', `El campo 'estado_acuse' debe ser uno de: ${ESTADOS_ACUSE.join(', ')}.`),
    ]);
  }
  return estado;
};

module.exports = { validarAcuse, validarEstadoAcuse, MAX_COMENTARIO };
