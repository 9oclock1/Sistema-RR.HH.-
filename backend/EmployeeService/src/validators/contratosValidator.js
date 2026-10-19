const { esVacio, invalido, cuerpoComoObjeto, normalizarTexto, normalizarUuid, lanzarSiHayErrores, validarIdRuta } = require('./comunes');
const { normalizarOpcion, normalizarEntero, normalizarFecha } = require('./capacitacionesValidator');
const HttpError = require('../utils/HttpError');

const TIPOS_MODIFICACION = ['RENOVACION', 'CAMBIO_JORNADA', 'AJUSTE_SALARIAL', 'AJUSTE_CONDICIONES'];
const MONTO_REGEX = /^\d{1,10}(\.\d{1,2})?$/;
const SMALLINT_MAX = 32767;

const normalizarCatalogo = (valor, campo, errores) => {
  const id = normalizarEntero(valor, campo, {}, errores);
  if (id !== null && id > SMALLINT_MAX) {
    errores.push(invalido(campo, `El campo '${campo}' no corresponde a un valor del catálogo.`));
    return null;
  }
  return id;
};

const normalizarHaber = (valor, campo, errores) => {
  if (esVacio(valor)) return null;
  const texto = typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : valor;
  if (typeof texto !== 'string' || !MONTO_REGEX.test(texto.trim()) || Number(texto) <= 0) {
    errores.push(invalido(campo, `El campo '${campo}' debe ser un monto mayor a cero con hasta 2 decimales.`));
    return null;
  }
  return texto.trim();
};

const validarModificacion = (body) => {
  const datos = cuerpoComoObjeto(body);
  const errores = [];

  const modificacion = {
    id_empleado: normalizarUuid(datos.id_empleado, 'id_empleado', { requerido: true }, errores),
    tipo_modificacion: normalizarOpcion(datos.tipo_modificacion, 'tipo_modificacion', TIPOS_MODIFICACION, { requerido: true }, errores),
    numero_contrato: normalizarTexto(datos.numero_contrato, 'numero_contrato', { requerido: true, maxLength: 40 }, errores),
    fecha_vigencia: normalizarFecha(datos.fecha_vigencia, 'fecha_vigencia', { requerido: true }, errores),
    fecha_fin: normalizarFecha(datos.fecha_fin, 'fecha_fin', {}, errores),
    justificacion: normalizarTexto(datos.justificacion, 'justificacion', { requerido: true, maxLength: 2000 }, errores),
    id_tipo_contrato: normalizarCatalogo(datos.id_tipo_contrato, 'id_tipo_contrato', errores),
    id_tipo_jornada: normalizarCatalogo(datos.id_tipo_jornada, 'id_tipo_jornada', errores),
    haber_mensual_pactado: normalizarHaber(datos.haber_mensual_pactado, 'haber_mensual_pactado', errores),
  };

  const { tipo_modificacion, fecha_vigencia, fecha_fin } = modificacion;
  if (tipo_modificacion && tipo_modificacion !== 'RENOVACION') {
    if (fecha_fin) {
      errores.push(invalido('fecha_fin', 'Una adenda conserva la fecha de fin del contrato; solo una renovación define una nueva.'));
    }
    if (modificacion.id_tipo_contrato !== null) {
      errores.push(invalido('id_tipo_contrato', 'Para cambiar el tipo de contrato registre una renovación.'));
    }
  }
  if (tipo_modificacion === 'CAMBIO_JORNADA' && esVacio(datos.id_tipo_jornada)) {
    errores.push(invalido('id_tipo_jornada', 'Un cambio de jornada debe indicar la nueva jornada.'));
  }
  if (tipo_modificacion === 'AJUSTE_SALARIAL' && esVacio(datos.haber_mensual_pactado)) {
    errores.push(invalido('haber_mensual_pactado', 'Un ajuste salarial debe indicar el nuevo haber mensual.'));
  }
  if (fecha_vigencia && fecha_fin && fecha_fin < fecha_vigencia) {
    errores.push(invalido('fecha_fin', 'La fecha de fin no puede ser anterior a la fecha de vigencia.'));
  }

  lanzarSiHayErrores(errores);
  return modificacion;
};

const validarFiltrosContratos = (query) => {
  const datos = cuerpoComoObjeto(query);
  const errores = [];
  const filtros = { id_empleado: normalizarUuid(datos.id_empleado, 'id_empleado', { requerido: true }, errores) };
  lanzarSiHayErrores(errores);
  return filtros;
};

const validarRegistrador = (valor) => {
  if (esVacio(valor)) {
    const mensaje = 'Identifique al usuario que registra el cambio.';
    throw new HttpError(401, mensaje, { campos_faltantes: ['X-Usuario-Id'], errores: [{ campo: 'X-Usuario-Id', mensaje }] });
  }
  const errores = [];
  const id = normalizarUuid(valor, 'X-Usuario-Id', {}, errores);
  lanzarSiHayErrores(errores);
  return id;
};

const validarId = (valor) => validarIdRuta(valor, 'id');

module.exports = { TIPOS_MODIFICACION, validarModificacion, validarFiltrosContratos, validarRegistrador, validarId };
