const { cuerpoComoObjeto, normalizarTexto, normalizarUuid, lanzarSiHayErrores, validarIdRuta } = require('./comunes');

const MAX_CODIGO = 20;
const MAX_NOMBRE = 100;
const MAX_DESCRIPCION = 255;
const validarDepartamento = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const departamento = {
    codigo: normalizarTexto(datos.codigo, 'codigo', { requerido: true, maxLength: MAX_CODIGO }, errores),
    nombre: normalizarTexto(datos.nombre, 'nombre', { requerido: true, maxLength: MAX_NOMBRE }, errores),
    descripcion: normalizarTexto(datos.descripcion, 'descripcion', { maxLength: MAX_DESCRIPCION }, errores),
    id_departamento_padre: normalizarUuid(datos.id_departamento_padre, 'id_departamento_padre', {}, errores),
  };

  lanzarSiHayErrores(errores);
  return departamento;
};

const validarIdDepartamento = (valor) => validarIdRuta(valor, 'id');

module.exports = { validarDepartamento, validarIdDepartamento };
