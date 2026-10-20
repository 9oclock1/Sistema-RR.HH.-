const pool = require('../../db/pool');
const solicitudesModel = require('../models/solicitudesServicioModel');
const cursosModel = require('../models/cursosCapacitacionModel');
const comprasPubSubService = require('./comprasPubSubService');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const MINUTOS_PRIMER_REINTENTO = 5;
const MINUTOS_MAX_ESPERA = 60;
const COSTO_SIMULADO_POR_PARTICIPANTE = 150;

const PROVEEDORES_SIMULADOS = [
  { nombre: 'Capacita SRL', nit: '1020304050' },
  { nombre: 'Instituto de Formación Andina', nit: '2030405060' },
  { nombre: 'Consultora Talento Bolivia', nit: '3040506070' },
];

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
    const { id_pubsub, mensaje } = await comprasPubSubService.publicarSolicitudCompraCapacitacion(solicitud);
    await withTransaction(async (client) => {
      const actual = await solicitudesModel.bloquearPorId(client, idSolicitud);
      if (actual?.estado !== 'PENDIENTE_ENVIO') return;

      await solicitudesModel.marcarEnviada(client, idSolicitud);
      await solicitudesModel.registrarEvento(client, {
        id_solicitud_servicio: idSolicitud,
        estado_anterior: 'PENDIENTE_ENVIO',
        estado_nuevo: 'ENVIADA',
        origen: 'RRHH',
        detalle: `Publicada en Pub/Sub con id_mensaje ${solicitud.id_mensaje} (id de Pub/Sub ${id_pubsub}).`,
        carga_mensaje: mensaje,
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
  const pendientes = await solicitudesModel.listarPendientesDeEnvio(pool, limite);
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

const respuestaSimulada = (solicitud) => {
  const clave = solicitud.id_mensaje.replace(/-/g, '').toUpperCase();
  if (solicitud.estado === 'ENVIADA') {
    return {
      id_mensaje_externo: `sim-${solicitud.id_mensaje}-EN_PROCESO`,
      estado: 'EN_PROCESO',
      numero_orden_servicio: null,
      proveedor_nombre: null,
      proveedor_nit: null,
      monto_adjudicado: null,
      detalle: 'Compras recibió la solicitud y está cotizando proveedores (respuesta simulada).',
    };
  }

  const proveedor = PROVEEDORES_SIMULADOS[parseInt(clave.slice(0, 8), 16) % PROVEEDORES_SIMULADOS.length];
  return {
    id_mensaje_externo: `sim-${solicitud.id_mensaje}-ORDEN_EMITIDA`,
    estado: 'ORDEN_EMITIDA',
    numero_orden_servicio: `OS-${new Date().getFullYear()}-${clave.slice(0, 12)}`,
    proveedor_nombre: proveedor.nombre,
    proveedor_nit: proveedor.nit,
    monto_adjudicado: solicitud.monto_estimado ?? (solicitud.cantidad_participantes * COSTO_SIMULADO_POR_PARTICIPANTE).toFixed(2),
    detalle: 'Compras emitió la orden de servicio (respuesta simulada).',
  };
};

const simularRespuestasCompras = async ({ minutosPorEtapa = 1, limite = 20 } = {}) => {
  const solicitudes = await solicitudesModel.listarParaRespuestaSimulada(pool, minutosPorEtapa, limite);
  const resultado = { revisadas: solicitudes.length, en_proceso: 0, ordenes_emitidas: 0, fallidas: 0 };

  for (const solicitud of solicitudes) {
    const respuesta = respuestaSimulada(solicitud);
    try {
      await registrarRespuestaCompras(solicitud.id_solicitud_servicio, respuesta);
      if (respuesta.estado === 'EN_PROCESO') resultado.en_proceso += 1;
      else resultado.ordenes_emitidas += 1;
    } catch (error) {
      resultado.fallidas += 1;
      console.error(`[compras] No se pudo simular la respuesta de la solicitud ${solicitud.id_solicitud_servicio}`, error.message);
    }
  }
  return resultado;
};

module.exports = {
  solicitarCompra,
  reintentarPendientes,
  simularRespuestasCompras,
  listarSolicitudes,
  obtenerSolicitud,
  registrarRespuestaCompras,
};
