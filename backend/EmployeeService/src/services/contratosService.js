const fs = require('node:fs');
const pool = require('../../db/pool');
const contratosModel = require('../models/contratosModel');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');
const { TIPOS_MODIFICACION } = require('../validators/contratosValidator');
const { rutaEnDisco } = require('../middlewares/documentoContratoUpload');

const TIPO_INDEFINIDO = 'INDEFINIDO';

const errorDeCampo = (status, campo, mensaje) =>
  new HttpError(status, mensaje, { campos_faltantes: [], errores: [{ campo, mensaje }] });

const prepararRenovacion = async (client, modificacion, actual) => {
  const { fecha_vigencia, fecha_fin } = modificacion;
  if (actual.fecha_fin === null) {
    throw errorDeCampo(409, 'tipo_modificacion', `El contrato ${actual.numero_contrato} es indefinido; para cambiar sus condiciones registre una adenda.`);
  }
  if (fecha_vigencia <= actual.fecha_fin) {
    throw errorDeCampo(409, 'fecha_vigencia', `La renovación debe empezar después del ${actual.fecha_fin}, fecha de fin del contrato ${actual.numero_contrato}.`);
  }

  const idTipoContrato = modificacion.id_tipo_contrato ?? actual.id_tipo_contrato;
  const tipoContrato = await contratosModel.obtenerTipoContrato(client, idTipoContrato);
  if (!tipoContrato) {
    throw errorDeCampo(400, 'id_tipo_contrato', 'El tipo de contrato seleccionado no existe.');
  }
  const esIndefinido = tipoContrato.codigo === TIPO_INDEFINIDO;
  if (esIndefinido && fecha_fin) {
    throw errorDeCampo(400, 'fecha_fin', 'Un contrato indefinido no tiene fecha de fin.');
  }
  if (!esIndefinido && !fecha_fin) {
    throw errorDeCampo(400, 'fecha_fin', `El contrato de tipo «${tipoContrato.nombre}» debe indicar su fecha de fin.`);
  }

  const solapado = await contratosModel.buscarSolapamiento(client, modificacion.id_empleado, fecha_vigencia, fecha_fin);
  if (solapado) {
    const hasta = solapado.fecha_fin ?? 'sin fecha de fin';
    throw errorDeCampo(409, 'fecha_vigencia', `Las fechas se solapan con el contrato ${solapado.numero_contrato} (${solapado.fecha_inicio} a ${hasta}).`);
  }

  return {
    es_adenda: false,
    id_tipo_contrato: idTipoContrato,
    fecha_fin,
  };
};

const prepararAdenda = (modificacion, actual) => {
  const { tipo_modificacion, fecha_vigencia } = modificacion;
  if (fecha_vigencia <= actual.fecha_vigencia) {
    throw errorDeCampo(409, 'fecha_vigencia', `La fecha de vigencia debe ser posterior al ${actual.fecha_vigencia}, inicio de la versión vigente del contrato ${actual.numero_contrato}.`);
  }
  if (actual.fecha_fin !== null && fecha_vigencia > actual.fecha_fin) {
    throw errorDeCampo(409, 'fecha_vigencia', `El contrato ${actual.numero_contrato} termina el ${actual.fecha_fin}; para continuar la relación laboral registre una renovación.`);
  }
  if (tipo_modificacion === 'CAMBIO_JORNADA' && modificacion.id_tipo_jornada === actual.id_tipo_jornada) {
    throw errorDeCampo(400, 'id_tipo_jornada', 'La nueva jornada es igual a la vigente.');
  }
  if (tipo_modificacion === 'AJUSTE_SALARIAL' && Number(modificacion.haber_mensual_pactado) === Number(actual.haber_mensual_pactado)) {
    throw errorDeCampo(400, 'haber_mensual_pactado', 'El nuevo haber mensual es igual al vigente.');
  }

  return {
    es_adenda: true,
    id_tipo_contrato: actual.id_tipo_contrato,
    fecha_fin: actual.fecha_fin,
  };
};

const registrarModificacion = (modificacion, documento, registrador) =>
  withTransaction(async (client) => {
    const { id_empleado } = modificacion;
    if (!(await contratosModel.bloquearEmpleado(client, id_empleado))) {
      throw errorDeCampo(400, 'id_empleado', 'El colaborador indicado no existe.');
    }

    const actual = await contratosModel.obtenerVersionActual(client, id_empleado);
    if (!actual) {
      throw errorDeCampo(409, 'id_empleado', 'El colaborador no tiene un contrato registrado; registre primero su contrato inicial.');
    }
    if (await contratosModel.existeNumero(client, modificacion.numero_contrato)) {
      throw errorDeCampo(409, 'numero_contrato', `Ya existe un contrato o adenda con el número ${modificacion.numero_contrato}.`);
    }

    const segunTipo = modificacion.tipo_modificacion === 'RENOVACION'
      ? await prepararRenovacion(client, modificacion, actual)
      : prepararAdenda(modificacion, actual);

    const idContrato = await contratosModel.insertar(client, {
      ...modificacion,
      ...segunTipo,
      id_tipo_jornada: modificacion.id_tipo_jornada ?? actual.id_tipo_jornada,
      haber_mensual_pactado: modificacion.haber_mensual_pactado ?? actual.haber_mensual_pactado,
      id_contrato_anterior: actual.id_contrato,
      documento,
      registrado_por: registrador.id,
      registrado_rol: registrador.rol,
    });
    return contratosModel.obtenerVersion(client, id_empleado, idContrato);
  });

const listarHistorial = async ({ id_empleado }) => {
  if (!(await contratosModel.existeEmpleado(pool, id_empleado))) {
    throw new HttpError(404, 'El colaborador solicitado no existe.');
  }
  return contratosModel.listarHistorial(pool, id_empleado);
};

const obtenerCatalogos = async () => ({
  ...(await contratosModel.listarCatalogos(pool)),
  tipos_modificacion: TIPOS_MODIFICACION,
});

const obtenerDocumento = async (idContrato) => {
  const contrato = await contratosModel.obtenerDocumento(pool, idContrato);
  if (!contrato) throw new HttpError(404, 'El contrato solicitado no existe.');
  if (!contrato.documento_adjunto_url) throw new HttpError(404, 'El contrato no tiene un documento firmado adjunto.');

  const ruta = rutaEnDisco(contrato.documento_adjunto_url);
  if (!ruta || !fs.existsSync(ruta)) throw new HttpError(404, 'El archivo del documento no está disponible.');

  return { ruta, nombre: contrato.documento_nombre_original, tipoMime: contrato.documento_tipo_mime };
};

module.exports = { registrarModificacion, listarHistorial, obtenerCatalogos, obtenerDocumento };
