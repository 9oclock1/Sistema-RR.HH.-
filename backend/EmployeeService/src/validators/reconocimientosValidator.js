const { invalido, cuerpoComoObjeto, normalizarTexto, normalizarUuid, lanzarSiHayErrores } = require('./comunes');
const { normalizarIdTipoMemo } = require('./memorandumsValidator');

const validarReconocimiento = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const reconocimiento = {
    id_empleado_receptor: normalizarUuid(datos.id_empleado_receptor, 'id_empleado_receptor', { requerido: true }, errores),
    id_empleado_emisor: normalizarUuid(datos.id_empleado_emisor, 'id_empleado_emisor', { requerido: true }, errores),
    id_tipo_memo: normalizarIdTipoMemo(datos.id_tipo_memo, 'id_tipo_memo', errores),
    asunto: normalizarTexto(datos.asunto, 'asunto', { requerido: true, maxLength: 150 }, errores),
    contenido_descripcion: normalizarTexto(datos.contenido_descripcion, 'contenido_descripcion', { requerido: true }, errores),
  };

  if (reconocimiento.id_empleado_receptor && reconocimiento.id_empleado_receptor === reconocimiento.id_empleado_emisor) {
    errores.push(invalido('id_empleado_receptor', 'El empleado reconocido no puede ser el mismo que emite el reconocimiento.'));
  }

  lanzarSiHayErrores(errores);
  return reconocimiento;
};

module.exports = { validarReconocimiento };
