const HttpError = require('../utils/HttpError');
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const esVacio = (valor) =>
  valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

const faltante = (campo) => ({ campo, tipo: 'faltante', mensaje: `El campo '${campo}' es obligatorio.` });
const invalido = (campo, mensaje) => ({ campo, tipo: 'invalido', mensaje });

const cuerpoComoObjeto = (body) => (body && typeof body === 'object' && !Array.isArray(body) ? body : {});

const normalizarTexto = (valor, campo, { requerido = false, maxLength } = {}, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return null;
  }
  if (typeof valor !== 'string') {
    errores.push(invalido(campo, `El campo '${campo}' debe ser texto.`));
    return null;
  }
  const limpio = valor.trim();
  if (maxLength && limpio.length > maxLength) {
    errores.push(invalido(campo, `El campo '${campo}' no puede superar los ${maxLength} caracteres.`));
    return null;
  }
  return limpio;
};

const normalizarUuid = (valor, campo, { requerido = false } = {}, errores) => {
  if (esVacio(valor)) {
    if (requerido) errores.push(faltante(campo));
    return null;
  }
  if (typeof valor !== 'string' || !UUID_REGEX.test(valor.trim())) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un UUID válido.`));
    return null;
  }
  return valor.trim().toLowerCase();
};

// encabezado: frase opcional que antecede a la lista de errores (p. ej. «No se puede publicar la convocatoria.»).
const lanzarSiHayErrores = (errores, encabezado = null) => {
  if (errores.length === 0) return;

  const camposFaltantes = errores.filter((e) => e.tipo === 'faltante').map((e) => e.campo);
  const partes = encabezado ? [encabezado] : [];

  if (camposFaltantes.length === 1) {
    partes.push(`Falta el campo obligatorio: ${camposFaltantes[0]}.`);
  } else if (camposFaltantes.length > 1) {
    partes.push(`Faltan los campos obligatorios: ${camposFaltantes.join(', ')}.`);
  }
  errores.filter((e) => e.tipo === 'invalido').forEach((e) => partes.push(e.mensaje));

  throw new HttpError(400, partes.join(' '), {
    campos_faltantes: camposFaltantes,
    errores: errores.map(({ campo, mensaje }) => ({ campo, mensaje })),
  });
};

// Para parámetros de ruta como /:id.
const validarIdRuta = (valor, campo = 'id') => {
  const errores = [];
  const id = normalizarUuid(valor, campo, { requerido: true }, errores);
  lanzarSiHayErrores(errores);
  return id;
};

module.exports = {
  esVacio,
  faltante,
  invalido,
  cuerpoComoObjeto,
  normalizarTexto,
  normalizarUuid,
  lanzarSiHayErrores,
  validarIdRuta,
};
