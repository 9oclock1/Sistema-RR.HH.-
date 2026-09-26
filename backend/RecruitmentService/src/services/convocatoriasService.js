const pool = require('../../db/pool');
const convocatoriasModel = require('../models/convocatoriasModel');
const perfilCargoService = require('./perfilCargoService');
const HttpError = require('../utils/HttpError');
const { hoy } = require('../utils/fechas');
const { withTransaction } = require('../utils/transaction');
const { lanzarSiHayErrores } = require('../validators/comunes');
const { erroresParaPublicar } = require('../validators/convocatoriasValidator');

const noEncontrada = () => new HttpError(404, 'La convocatoria solicitada no existe.');
const ESTADO_REQUERIDO = { editar: 'borrador', publicar: 'borrador', cerrar: 'publicada' };
const MENSAJES_TRANSICION_INVALIDA = {
  editar: {
    publicada: 'Una convocatoria publicada ya no se puede editar.',
    cerrada: 'Una convocatoria cerrada no se puede editar.',
  },
  publicar: {
    publicada: 'La convocatoria ya está publicada.',
    cerrada: 'Una convocatoria cerrada no se puede volver a publicar.',
  },
  cerrar: {
    borrador: 'Un borrador no se puede cerrar: todavía no fue publicado.',
    cerrada: 'La convocatoria ya está cerrada.',
  },
};

const exigirTransicion = (convocatoria, accion) => {
  if (convocatoria.estado !== ESTADO_REQUERIDO[accion]) {
    throw new HttpError(409, MENSAJES_TRANSICION_INVALIDA[accion][convocatoria.estado], {
      estado_actual: convocatoria.estado,
    });
  }
};

const exigirPublicable = (convocatoria) =>
  lanzarSiHayErrores(erroresParaPublicar(convocatoria, hoy()), 'No se puede publicar la convocatoria.');
const aRespuesta = (convocatoria) => ({
  ...convocatoria,
  acepta_postulaciones: convocatoria.estado === 'publicada',
  campos_pendientes:
    convocatoria.estado === 'borrador' ? erroresParaPublicar(convocatoria, hoy()).map((e) => e.campo) : [],
});

const listarConvocatorias = async (estado) => (await convocatoriasModel.listar(pool, { estado })).map(aRespuesta);

const obtenerConvocatoria = async (idConvocatoria) => {
  const convocatoria = await convocatoriasModel.obtenerPorId(pool, idConvocatoria);
  if (!convocatoria) throw noEncontrada();
  return aRespuesta(convocatoria);
};

const obtenerPerfilDesdeCargo = (idCargo) => perfilCargoService.obtenerPerfilDesdeCargo(idCargo, { status: 404 });
const crearConvocatoria = async (datos) => {
  const cargo = await perfilCargoService.obtenerCargoVigente(datos.id_cargo_referencial);
  const convocatoria = {
    cantidad_vacantes: 1,
    fecha_limite_postulacion: null,
    ...perfilCargoService.mapearCargoAConvocatoria(cargo),
    ...datos,
  };

  return withTransaction(async (client) => {
    convocatoria.codigo_convocatoria = await convocatoriasModel.generarCodigo(client);
    const idConvocatoria = await convocatoriasModel.insertarBorrador(client, convocatoria);
    return aRespuesta(await convocatoriasModel.obtenerPorId(client, idConvocatoria));
  });
};

const actualizarConvocatoria = async (idConvocatoria, cambios) => {
  if (cambios.id_cargo_referencial) await perfilCargoService.obtenerCargoVigente(cambios.id_cargo_referencial);

  return withTransaction(async (client) => {
    const actual = await convocatoriasModel.bloquearPorId(client, idConvocatoria);
    if (!actual) throw noEncontrada();
    exigirTransicion(actual, 'editar');

    await convocatoriasModel.actualizar(client, idConvocatoria, cambios);
    return aRespuesta(await convocatoriasModel.obtenerPorId(client, idConvocatoria));
  });
};

const publicarConvocatoria = async (idConvocatoria) => {
  const previa = await convocatoriasModel.obtenerPorId(pool, idConvocatoria);
  if (!previa) throw noEncontrada();
  exigirTransicion(previa, 'publicar');
  exigirPublicable(previa);
  await perfilCargoService.obtenerCargoVigente(previa.id_cargo_referencial);

  return withTransaction(async (client) => {
    const actual = await convocatoriasModel.bloquearPorId(client, idConvocatoria);
    exigirTransicion(actual, 'publicar');
    if (actual.id_cargo_referencial !== previa.id_cargo_referencial) {
      throw new HttpError(409, 'El cargo de la convocatoria cambió mientras se publicaba. Vuelva a intentarlo.');
    }
    exigirPublicable(actual);

    await convocatoriasModel.publicar(client, idConvocatoria);
    return aRespuesta(await convocatoriasModel.obtenerPorId(client, idConvocatoria));
  });
};

const cerrarConvocatoria = (idConvocatoria) =>
  withTransaction(async (client) => {
    const actual = await convocatoriasModel.bloquearPorId(client, idConvocatoria);
    if (!actual) throw noEncontrada();
    exigirTransicion(actual, 'cerrar');

    await convocatoriasModel.cerrar(client, idConvocatoria);
    return aRespuesta(await convocatoriasModel.obtenerPorId(client, idConvocatoria));
  });

module.exports = {
  listarConvocatorias,
  obtenerConvocatoria,
  obtenerPerfilDesdeCargo,
  crearConvocatoria,
  actualizarConvocatoria,
  publicarConvocatoria,
  cerrarConvocatoria,
};
