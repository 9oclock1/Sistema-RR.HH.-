const { esVacio, faltante, invalido, cuerpoComoObjeto, normalizarTexto, normalizarUuid, lanzarSiHayErrores } = require('./comunes');

const NATURALEZAS_FALTA = ['OPERATIVA', 'CONDUCTA'];
const GRAVEDADES_FALTA = ['LEVE', 'MODERADA', 'GRAVE'];
const CLASIFICACIONES = ['AMONESTACION', 'RECONOCIMIENTO'];
const SMALLINT_MAX = 32767;

// En multipart/form-data todos los campos llegan como texto.
const normalizarIdTipoMemo = (valor, campo, errores) => {
  if (esVacio(valor)) {
    errores.push(faltante(campo));
    return null;
  }
  const texto = String(valor).trim();
  const numero = Number(texto);
  if (!/^\d+$/.test(texto) || numero < 1 || numero > SMALLINT_MAX) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un número entero positivo.`));
    return null;
  }
  return numero;
};

const normalizarOpcion = (valor, campo, opciones, errores) => {
  const texto = normalizarTexto(valor, campo, { requerido: true }, errores);
  if (texto === null) return null;

  const opcion = texto.toUpperCase();
  if (!opciones.includes(opcion)) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser uno de: ${opciones.join(', ')}.`));
    return null;
  }
  return opcion;
};

const validarMemorandum = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const memorandum = {
    id_empleado_receptor: normalizarUuid(datos.id_empleado_receptor, 'id_empleado_receptor', { requerido: true }, errores),
    id_empleado_emisor: normalizarUuid(datos.id_empleado_emisor, 'id_empleado_emisor', { requerido: true }, errores),
    id_tipo_memo: normalizarIdTipoMemo(datos.id_tipo_memo, 'id_tipo_memo', errores),
    asunto: normalizarTexto(datos.asunto, 'asunto', { requerido: true, maxLength: 150 }, errores),
    contenido_descripcion: normalizarTexto(datos.contenido_descripcion, 'contenido_descripcion', { requerido: true }, errores),
    naturaleza_falta: normalizarOpcion(datos.naturaleza_falta, 'naturaleza_falta', NATURALEZAS_FALTA, errores),
    gravedad_falta: normalizarOpcion(datos.gravedad_falta, 'gravedad_falta', GRAVEDADES_FALTA, errores),
  };

  if (memorandum.id_empleado_receptor && memorandum.id_empleado_receptor === memorandum.id_empleado_emisor) {
    errores.push(invalido('id_empleado_receptor', 'El empleado amonestado no puede ser el mismo que emite el memorándum.'));
  }

  lanzarSiHayErrores(errores);
  return memorandum;
};

// Filtro opcional ?clasificacion= del catálogo de tipos; devuelve null cuando no se envía.
const validarClasificacion = (valor) => {
  if (esVacio(valor)) return null;

  const errores = [];
  const clasificacion = normalizarOpcion(valor, 'clasificacion', CLASIFICACIONES, errores);
  lanzarSiHayErrores(errores);
  return clasificacion;
};

module.exports = { validarMemorandum, validarClasificacion, normalizarIdTipoMemo };
