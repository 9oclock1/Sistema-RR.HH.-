const pool = require('../../db/pool');
const solicitudesModel = require('../models/solicitudesServicioModel');
const cursosModel = require('../models/cursosCapacitacionModel');
const comprasPubSubService = require('./comprasPubSubService');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const MAX_INTENTOS_ENVIO = 5;
const MINUTOS_PRIMER_REINTENTO = 5;
const MINUTOS_MAX_ESPERA = 60;

const TRANSICIONES_COMPRAS = {
  ENVIADA: ['EN_PROCESO', 'ORDEN_EMITIDA', 'RECHAZADA'],
  EN_PROCESO: ['ORDEN_EMITIDA', 'RECHAZADA'],
};

const noEncontrada = () => new HttpError(404, 'La solicitud de servicio no existe.');

const errorDeCampo = (status, campo, mensaje) =>
  new HttpError(status, mensaje, { campos_faltantes: [], errores: [{ campo, mensaje }] });

const minutosDeEspera = (intentos) => Math.min(MINUTOS_PRIMER_REINTENTO * 2 ** intentos, MINUTOS_MAX_ESPERA);

const conHistorial = async (db, idSolicitud) => {
  const solicitud = await solicitudesModel.obtenerPorId(db, idSolicitud);
  return { ...solicitud, historial: await solicitudesModel.listarHistorial(db, idSolicitud) };
};

const enviarSolicitud = async (idSolicitud) => {
  const solicitud = await solicitudesModel.obtenerPorId(pool, idSolicitud);
  if (!solicitud || solicitud.estado !== 'PENDIENTE_ENVIO') return solicitud;

  try {
    const { id_mensaje, simulado, evento } = await comprasPubSubService.publicarSolicitudCompraCapacitacion(solicitud);
    await withTransaction(async (client) => {
      const actual = await solicitudesModel.bloquearPorId(client, idSolicitud);
      if (actual?.estado !== 'PENDIENTE_ENVIO') return;

      await solicitudesModel.marcarEnviada(client, idSolicitud);
      await solicitudesModel.registrarEvento(client, {
        id_solicitud_servicio: idSolicitud,
        estado_anterior: 'PENDIENTE_ENVIO',
        estado_nuevo: 'ENVIADA',
        origen: 'RRHH',
        detalle: `Publicada en Pub/Sub${simulado ? ' (simulado)' : ''} con id de mensaje ${id_mensaje}.`,
        carga_mensaje: evento,
      });
    });
  } catch (error) {
    console.error(`[compras] No se pudo publicar la solicitud ${idSolicitud}`, error.message);
    await solicitudesModel.registrarFalloEnvio(pool, idSolicitud, error.message, minutosDeEspera(solicitud.intentos_envio));
  }

  return solicitudesModel.obtenerPorId(pool, idSolicitud);
};

const solicitarCompra = async (idCurso, datos) => {
  const idSolicitud = await withTransaction(async (client) => {
    const curso = await cursosModel.obtenerParaRegistro(client, idCurso);
    if (!curso) throw new HttpError(404, 'El curso solicitado no existe.');
    if (!curso.esta_activo) throw new HttpError(409, 'No se puede solicitar la compra de un curso dado de baja.');

    const id = await solicitudesModel.insertar(client, { ...datos, id_curso: idCurso }, MINUTOS_PRIMER_REINTENTO);
    await solicitudesModel.registrarEvento(client, {
      id_solicitud_servicio: id,
      estado_nuevo: 'PENDIENTE_ENVIO',
      origen: 'RRHH',
      detalle: 'Solicitud de servicio de capacitación registrada por RRHH.',
    });
    return id;
  });

  await enviarSolicitud(idSolicitud);
  return conHistorial(pool, idSolicitud);
};

const reintentarPendientes = async (limite = 20) => {
  const pendientes = await solicitudesModel.listarPendientesDeEnvio(pool, MAX_INTENTOS_ENVIO, limite);
  const resultado = { revisadas: pendientes.length, enviadas: 0 };
  for (const idSolicitud of pendientes) {
    const solicitud = await enviarSolicitud(idSolicitud);
    if (solicitud?.estado === 'ENVIADA') resultado.enviadas += 1;
  }
  return resultado;
};

const listarSolicitudes = (filtros) => solicitudesModel.listar(pool, filtros);

const obtenerSolicitud = async (idSolicitud) => {
  const solicitud = await solicitudesModel.obtenerPorId(pool, idSolicitud);
  if (!solicitud) throw noEncontrada();
  return conHistorial(pool, idSolicitud);
};

const registrarRespuestaCompras = (idSolicitud, respuesta) =>
  withTransaction(async (client) => {
    const actual = await solicitudesModel.bloquearPorId(client, idSolicitud);
    if (!actual) throw noEncontrada();

    const solicitudDelMensaje = await solicitudesModel.existeMensajeExterno(client, respuesta.id_mensaje_externo);
    if (solicitudDelMensaje === idSolicitud) {
      return { ...(await conHistorial(client, idSolicitud)), mensaje_duplicado: true };
    }
    if (solicitudDelMensaje) {
      throw errorDeCampo(409, 'id_mensaje_externo', 'El mensaje de Compras ya fue registrado para otra solicitud.');
    }

    if (!(TRANSICIONES_COMPRAS[actual.estado] || []).includes(respuesta.estado)) {
      throw errorDeCampo(
        409,
        'estado',
        `Una solicitud en estado ${actual.estado} no puede pasar a ${respuesta.estado}.`
      );
    }

    if (
      respuesta.numero_orden_servicio &&
      (await solicitudesModel.existeNumeroOrden(client, respuesta.numero_orden_servicio, idSolicitud))
    ) {
      throw errorDeCampo(409, 'numero_orden_servicio', 'El número de orden de servicio ya pertenece a otra solicitud.');
    }

    await solicitudesModel.aplicarRespuestaCompras(client, idSolicitud, respuesta);
    await solicitudesModel.registrarEvento(client, {
      id_solicitud_servicio: idSolicitud,
      estado_anterior: actual.estado,
      estado_nuevo: respuesta.estado,
      origen: 'COMPRAS',
      id_mensaje_externo: respuesta.id_mensaje_externo,
      detalle: respuesta.detalle,
      carga_mensaje: respuesta,
    });

    return { ...(await conHistorial(client, idSolicitud)), mensaje_duplicado: false };
  });

module.exports = {
  solicitarCompra,
  reintentarPendientes,
  listarSolicitudes,
  obtenerSolicitud,
  registrarRespuestaCompras,
};
