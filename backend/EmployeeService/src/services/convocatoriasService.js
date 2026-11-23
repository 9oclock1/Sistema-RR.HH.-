const pool = require('../../db/pool');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');
const modelo = require('../models/convocatoriasModel');
const { avisarElegible } = require('./convocatoriasNotificacionService');
const { adjuntarMisPostulaciones } = require('./postulacionesService');
const { mesesCompletos } = require('../utils/meritos');
const { validarConvocatoria, validarFiltroEstado } = require('../validators/convocatoriasValidator');
const { ROLES_RRHH } = require('../middlewares/autenticar');

const MENSAJE_SOLO_ACTIVOS = 'Solo los empleados activos pueden consultar las convocatorias internas.';
const NO_ENCONTRADA = 'No se encontró la convocatoria interna solicitada.';
const AVISOS_EN_PARALELO = 4;

const conflicto = (mensaje, codigo) => new HttpError(409, mensaje, { codigo });

const exigirEmpleadoActivo = async (idEmpleado) => {
  if (!(await modelo.empleadoEstaActivo(pool, idEmpleado))) throw new HttpError(403, MENSAJE_SOLO_ACTIVOS);
};

const describirNotificacion = (convocatoria) => ({
  estado: convocatoria.estado_notificacion,
  destinatarios: convocatoria.destinatarios_notificados,
  notificada_en: convocatoria.notificada_en,
  error: convocatoria.ultimo_error_notificacion,
});

const elegiblesPara = (candidatos, convocatoria) =>
  candidatos
    .map((candidato) => ({
      id_empleado: candidato.id_empleado,
      meses: mesesCompletos(candidato.fecha_ingreso, convocatoria.fecha_cierre_postulacion),
    }))
    .filter((candidato) => candidato.meses >= convocatoria.meses_antiguedad_minima);

const exigirVacante = async (datos, cargo, sucursal) => {
  const puesto = { idCargo: datos.id_cargo, idSucursal: datos.id_sucursal };
  const [ocupantes, vigente] = await Promise.all([
    modelo.listarOcupantesActivos(pool, puesto),
    modelo.buscarVigenteMismoPuesto(pool, puesto),
  ]);
  if (ocupantes.length > 0) {
    const nombres = ocupantes.map((o) => o.nombre_completo).join(', ');
    throw conflicto(`El cargo «${cargo.nombre}» no está vacante en ${sucursal.nombre}: lo ocupa ${nombres}.`, 'CARGO_OCUPADO');
  }
  if (vigente) {
    throw conflicto(`Ya hay una convocatoria vigente para «${cargo.nombre}» en ${sucursal.nombre}: «${vigente.titulo}».`, 'CONVOCATORIA_DUPLICADA');
  }
};

const enviarAvisos = async (convocatoria, idPublicador) => {
  const pendientes = await modelo.listarDestinatariosPendientes(pool, convocatoria.id_convocatoria);
  const errores = [];
  for (let inicio = 0; inicio < pendientes.length; inicio += AVISOS_EN_PARALELO) {
    const lote = pendientes.slice(inicio, inicio + AVISOS_EN_PARALELO);
    await Promise.all(
      lote.map(async (destinatario) => {
        const resultado = await avisarElegible(convocatoria, destinatario, { idPublicador });
        if (resultado.entregada) {
          await modelo.registrarAvisoEntregado(pool, convocatoria.id_convocatoria, destinatario.id_empleado);
        } else {
          errores.push(resultado.error);
          await modelo.registrarAvisoFallido(pool, convocatoria.id_convocatoria, destinatario.id_empleado, resultado.error);
        }
      })
    );
  }

  const { total, notificados } = await modelo.contarDestinatarios(pool, convocatoria.id_convocatoria);
  if (errores.length === 0) {
    await modelo.registrarNotificacionEntregada(pool, convocatoria.id_convocatoria, notificados);
  } else {
    const motivo = `No se entregaron ${total - notificados} de ${total} avisos: ${errores[0]}`;
    console.error(`[convocatorias] ${convocatoria.id_convocatoria}: ${motivo}`);
    await modelo.registrarNotificacionFallida(pool, convocatoria.id_convocatoria, motivo);
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
  await exigirVacante(datos, cargo, sucursal);

  const idPublicador = await resolverPublicador(idEmpleado);
  const elegibles = elegiblesPara(await modelo.listarCandidatosAviso(pool, datos.id_cargo), datos);
  const idConvocatoria = await withTransaction(async (cliente) => {
    const id = await modelo.insertar(cliente, { ...datos, id_empleado_publicador: idPublicador });
    await modelo.insertarDestinatarios(cliente, id, elegibles);
    return id;
  });
  const convocatoria = await enviarAvisos(await modelo.obtenerPorId(pool, idConvocatoria), idPublicador);

  return { ...convocatoria, notificacion: describirNotificacion(convocatoria) };
};

const reintentarNotificacion = async (idConvocatoria, { idEmpleado } = {}) => {
  const convocatoria = await modelo.obtenerPorId(pool, idConvocatoria);
  if (!convocatoria) throw new HttpError(404, NO_ENCONTRADA);
  if (convocatoria.estado_notificacion === modelo.ESTADO_NOTIFICACION.ENTREGADA) {
    throw new HttpError(409, 'La convocatoria ya fue notificada a los empleados elegibles.');
  }
  if (convocatoria.estado === 'CERRADA') {
    throw new HttpError(409, 'No se notifica una convocatoria que ya cerró.');
  }

  const actualizada = await enviarAvisos(convocatoria, await resolverPublicador(idEmpleado));
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

const obtener = async (idConvocatoria, { rol, idEmpleado }) => {
  if (!ROLES_RRHH.includes(rol)) await exigirEmpleadoActivo(idEmpleado);
  const convocatoria = await modelo.obtenerPorId(pool, idConvocatoria);
  if (!convocatoria) throw new HttpError(404, NO_ENCONTRADA);
  return convocatoria;
};

const cerrarVencidas = async () => modelo.cerrarVencidas(pool);

module.exports = { publicar, reintentarNotificacion, listarGestion, listarParaEmpleado, obtener, cerrarVencidas, MENSAJE_SOLO_ACTIVOS };
