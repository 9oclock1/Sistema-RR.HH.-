const pool = require('../../db/pool');
const HttpError = require('../utils/HttpError');
const modelo = require('../models/convocatoriasModel');
const { notificarConvocatoria } = require('./convocatoriasNotificacionService');
const { adjuntarMisPostulaciones } = require('./postulacionesService');
const { validarConvocatoria, validarFiltroEstado } = require('../validators/convocatoriasValidator');

const MENSAJE_SOLO_ACTIVOS = 'Solo los empleados activos pueden consultar las convocatorias internas.';
const NO_ENCONTRADA = 'No se encontró la convocatoria interna solicitada.';

const exigirEmpleadoActivo = async (idEmpleado) => {
  if (!(await modelo.empleadoEstaActivo(pool, idEmpleado))) throw new HttpError(403, MENSAJE_SOLO_ACTIVOS);
};

const describirNotificacion = (convocatoria) => ({
  estado: convocatoria.estado_notificacion,
  destinatarios: convocatoria.destinatarios_notificados,
  notificada_en: convocatoria.notificada_en,
  error: convocatoria.ultimo_error_notificacion,
});

const enviarNotificacion = async (convocatoria, idPublicador) => {
  const resultado = await notificarConvocatoria(convocatoria, { idPublicador });
  if (resultado.entregada) {
    await modelo.registrarNotificacionEntregada(pool, convocatoria.id_convocatoria, resultado.destinatarios);
  } else {
    console.error(`[convocatorias] No se pudo notificar la convocatoria ${convocatoria.id_convocatoria}: ${resultado.error}`);
    await modelo.registrarNotificacionFallida(pool, convocatoria.id_convocatoria, resultado.error);
  }
  return modelo.obtenerPorId(pool, convocatoria.id_convocatoria);
};

const resolverPublicador = async (idEmpleado) => (idEmpleado && (await modelo.existeEmpleado(pool, idEmpleado)) ? idEmpleado : null);

const publicar = async (cuerpo, { idEmpleado } = {}) => {
  const datos = validarConvocatoria(cuerpo);

  const [cargo, sucursal] = await Promise.all([
    modelo.buscarCargoActivo(pool, datos.id_cargo),
    modelo.buscarSucursalActiva(pool, datos.id_sucursal),
  ]);
  const errores = [];
  if (!cargo) errores.push({ campo: 'id_cargo', mensaje: 'El cargo no existe o está inactivo en el catálogo de cargos.' });
  if (!sucursal) errores.push({ campo: 'id_sucursal', mensaje: 'La sucursal no existe o está inactiva.' });
  if (errores.length > 0) {
    throw new HttpError(400, errores.map((e) => e.mensaje).join(' '), { campos_faltantes: [], errores });
  }

  const idPublicador = await resolverPublicador(idEmpleado);
  const idConvocatoria = await modelo.insertar(pool, { ...datos, id_empleado_publicador: idPublicador });
  const publicada = await modelo.obtenerPorId(pool, idConvocatoria);
  const convocatoria = await enviarNotificacion(publicada, idPublicador);

  return { ...convocatoria, notificacion: describirNotificacion(convocatoria) };
};

const reintentarNotificacion = async (idConvocatoria, { idEmpleado } = {}) => {
  const convocatoria = await modelo.obtenerPorId(pool, idConvocatoria);
  if (!convocatoria) throw new HttpError(404, NO_ENCONTRADA);
  if (convocatoria.estado_notificacion === modelo.ESTADO_NOTIFICACION.ENTREGADA) {
    throw new HttpError(409, 'La convocatoria ya fue notificada a los empleados activos.');
  }
  if (convocatoria.estado === 'CERRADA') {
    throw new HttpError(409, 'No se notifica una convocatoria que ya cerró.');
  }

  const actualizada = await enviarNotificacion(convocatoria, await resolverPublicador(idEmpleado));
  return { ...actualizada, notificacion: describirNotificacion(actualizada) };
};

const listarGestion = async (query = {}) => {
  const estados = validarFiltroEstado(query.estado, 'TODAS');
  const convocatorias = await modelo.listar(pool, { estados });
  return { convocatorias, total: convocatorias.length };
};

// KAN-81: cada convocatoria lleva la postulación del empleado (mi_postulacion), con su estado de validación.
const listarParaEmpleado = async (idEmpleado, query = {}) => {
  await exigirEmpleadoActivo(idEmpleado);
  const estados = validarFiltroEstado(query.estado, 'VIGENTES');
  const convocatorias = await adjuntarMisPostulaciones(await modelo.listar(pool, { estados }), idEmpleado);
  return { convocatorias, total: convocatorias.length };
};

const obtener = async (idConvocatoria, { esRrhh, idEmpleado }) => {
  if (!esRrhh) await exigirEmpleadoActivo(idEmpleado);
  const convocatoria = await modelo.obtenerPorId(pool, idConvocatoria);
  if (!convocatoria) throw new HttpError(404, NO_ENCONTRADA);
  return convocatoria;
};

const cerrarVencidas = async () => modelo.cerrarVencidas(pool);

module.exports = { publicar, reintentarNotificacion, listarGestion, listarParaEmpleado, obtener, cerrarVencidas, MENSAJE_SOLO_ACTIVOS };
