const fs = require('node:fs');
const pool = require('../../db/pool');
const capacitacionesModel = require('../models/capacitacionesModel');
const cursosModel = require('../models/cursosCapacitacionModel');
const asignacionesModel = require('../models/asignacionesModel');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');
const { descartarCertificado, rutaEnDisco } = require('../middlewares/certificadoUpload');

const noEncontrada = () => new HttpError(404, 'La capacitación solicitada no existe.');

const errorDeCampo = (status, campo, mensaje) =>
  new HttpError(status, mensaje, { campos_faltantes: [], errores: [{ campo, mensaje }] });

const descartarSiExiste = async (url) => {
  const ruta = url && rutaEnDisco(url);
  if (ruta) await descartarCertificado(ruta);
};

const validarSolicitudServicio = async (client, idSolicitud, idCurso) => {
  const solicitud = await capacitacionesModel.obtenerSolicitudServicio(client, idSolicitud);
  if (!solicitud) {
    throw errorDeCampo(400, 'id_solicitud_servicio', 'La solicitud de servicio indicada no existe.');
  }
  if (solicitud.estado !== 'ORDEN_EMITIDA') {
    throw errorDeCampo(400, 'id_solicitud_servicio', 'Solo se puede vincular una solicitud de servicio con orden emitida por Compras.');
  }
  if (solicitud.id_curso !== idCurso) {
    throw errorDeCampo(400, 'id_solicitud_servicio', 'La solicitud de servicio corresponde a otro curso.');
  }
};

const prepararRegistro = async (client, capacitacion, idExcluido = null) => {
  const curso = await cursosModel.obtenerParaRegistro(client, capacitacion.id_curso);
  if (!curso) throw errorDeCampo(400, 'id_curso', 'El curso seleccionado no existe.');
  if (!curso.esta_activo) throw errorDeCampo(400, 'id_curso', 'El curso seleccionado está dado de baja.');

  const hoy = await asignacionesModel.fechaActual(client);
  if (capacitacion.fecha_emision > hoy) {
    throw errorDeCampo(400, 'fecha_emision', 'La fecha de emisión no puede ser posterior a la fecha actual.');
  }

  let { fecha_vencimiento } = capacitacion;
  if (curso.requiere_vencimiento && !fecha_vencimiento) {
    if (!curso.meses_vigencia) {
      throw errorDeCampo(400, 'fecha_vencimiento', `El curso «${curso.nombre}» exige indicar la fecha de vencimiento.`);
    }
    fecha_vencimiento = await capacitacionesModel.sumarMeses(client, capacitacion.fecha_emision, curso.meses_vigencia);
  }

  if (capacitacion.id_solicitud_servicio) {
    await validarSolicitudServicio(client, capacitacion.id_solicitud_servicio, capacitacion.id_curso);
  }

  if (await capacitacionesModel.existeRegistro(client, capacitacion, idExcluido)) {
    throw errorDeCampo(409, 'fecha_emision', 'El colaborador ya tiene registrado este curso con la misma fecha de emisión.');
  }

  return { ...capacitacion, fecha_vencimiento };
};

const listarCapacitaciones = (filtros) => capacitacionesModel.listar(pool, filtros);

const obtenerCapacitacion = async (idCapacitacion) => {
  const capacitacion = await capacitacionesModel.obtenerPorId(pool, idCapacitacion);
  if (!capacitacion) throw noEncontrada();
  return capacitacion;
};

const registrarCapacitacion = (capacitacion, certificado) =>
  withTransaction(async (client) => {
    const registro = await prepararRegistro(client, capacitacion);
    const idCapacitacion = await capacitacionesModel.insertar(client, registro, certificado);
    return capacitacionesModel.obtenerPorId(client, idCapacitacion);
  });

const reemplazarCapacitacion = (idCapacitacion, capacitacion) =>
  withTransaction(async (client) => {
    const actual = await capacitacionesModel.bloquearPorId(client, idCapacitacion);
    if (!actual) throw noEncontrada();

    const registro = await prepararRegistro(client, { ...capacitacion, id_empleado: actual.id_empleado }, idCapacitacion);
    await capacitacionesModel.reemplazar(client, idCapacitacion, registro);
    return capacitacionesModel.obtenerPorId(client, idCapacitacion);
  });

const reemplazarCertificado = async (idCapacitacion, certificado) => {
  const { capacitacion, urlAnterior } = await withTransaction(async (client) => {
    const actual = await capacitacionesModel.bloquearPorId(client, idCapacitacion);
    if (!actual) throw noEncontrada();

    await capacitacionesModel.guardarCertificado(client, idCapacitacion, certificado);
    return {
      capacitacion: await capacitacionesModel.obtenerPorId(client, idCapacitacion),
      urlAnterior: actual.certificado_adjunto_url,
    };
  });

  await descartarSiExiste(urlAnterior);
  return capacitacion;
};

const quitarCertificado = async (idCapacitacion) => {
  const { capacitacion, urlAnterior } = await withTransaction(async (client) => {
    const actual = await capacitacionesModel.bloquearPorId(client, idCapacitacion);
    if (!actual) throw noEncontrada();
    if (!actual.certificado_adjunto_url) throw new HttpError(404, 'La capacitación no tiene un certificado adjunto.');

    await capacitacionesModel.guardarCertificado(client, idCapacitacion, null);
    return {
      capacitacion: await capacitacionesModel.obtenerPorId(client, idCapacitacion),
      urlAnterior: actual.certificado_adjunto_url,
    };
  });

  await descartarSiExiste(urlAnterior);
  return capacitacion;
};

const eliminarCapacitacion = async (idCapacitacion) => {
  const capacitacion = await withTransaction(async (client) => {
    const actual = await capacitacionesModel.bloquearPorId(client, idCapacitacion);
    if (!actual) throw noEncontrada();

    const eliminada = await capacitacionesModel.obtenerPorId(client, idCapacitacion);
    await capacitacionesModel.eliminar(client, idCapacitacion);
    return eliminada;
  });

  await descartarSiExiste(capacitacion.certificado_adjunto_url);
  return capacitacion;
};

const obtenerCertificado = async (idCapacitacion) => {
  const capacitacion = await obtenerCapacitacion(idCapacitacion);
  if (!capacitacion.certificado_adjunto_url) throw new HttpError(404, 'La capacitación no tiene un certificado adjunto.');

  const ruta = rutaEnDisco(capacitacion.certificado_adjunto_url);
  if (!ruta || !fs.existsSync(ruta)) throw new HttpError(404, 'El archivo del certificado no está disponible.');

  return {
    ruta,
    nombre: capacitacion.certificado_nombre_original,
    tipoMime: capacitacion.certificado_tipo_mime,
  };
};

module.exports = {
  listarCapacitaciones,
  obtenerCapacitacion,
  registrarCapacitacion,
  reemplazarCapacitacion,
  reemplazarCertificado,
  quitarCertificado,
  eliminarCapacitacion,
  obtenerCertificado,
};
