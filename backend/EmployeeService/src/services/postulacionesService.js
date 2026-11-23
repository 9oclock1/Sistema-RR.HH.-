const { randomUUID } = require('node:crypto');
const pool = require('../../db/pool');
const HttpError = require('../utils/HttpError');
const convocatoriasModel = require('../models/convocatoriasModel');
const modelo = require('../models/postulacionesModel');
const { obtenerUltimaEvaluacion } = require('./desempenoService');
const { ESTADO_POSTULACION, mesesCompletos, evaluarRequisitos, ordenarRanking, PESO_NOTA, PESO_ANTIGUEDAD, MESES_ANTIGUEDAD_TOPE } = require('../utils/meritos');

const conflicto = (mensaje, codigo, extra = {}) => new HttpError(409, mensaje, { codigo, ...extra });
const CONVOCATORIA_NO_ENCONTRADA = 'No se encontró la convocatoria interna solicitada.';

const obtenerConvocatoria = async (idConvocatoria) => {
  const convocatoria = await convocatoriasModel.obtenerPorId(pool, idConvocatoria);
  if (!convocatoria) throw new HttpError(404, CONVOCATORIA_NO_ENCONTRADA);
  return convocatoria;
};

// Criterio 2: la validación compara la permanencia (desde el ingreso hasta el día de la postulación) y la nota de la
// última evaluación de desempeño cerrada con los mínimos de la convocatoria. Si PerformanceService no responde, la
// postulación queda pendiente con el error y se puede volver a validar; no se marca no apta por una falla técnica.
const validar = async (postulacion, convocatoria) => {
  let ultimaEvaluacion;
  try {
    ultimaEvaluacion = await obtenerUltimaEvaluacion(postulacion.id_empleado);
  } catch (error) {
    console.error(`[postulaciones] No se pudo validar ${postulacion.id_postulacion}: ${error.message}`);
    if (postulacion.estado_postulacion === ESTADO_POSTULACION.PENDIENTE) {
      await modelo.registrarErrorValidacion(pool, postulacion.id_postulacion, error.message);
      return modelo.obtener(pool, postulacion.id_postulacion);
    }
    throw new HttpError(503, 'No se pudo consultar la evaluación de desempeño. La validación anterior se mantiene.');
  }
  const meses = mesesCompletos(postulacion.fecha_ingreso, postulacion.dia_postulacion);
  await modelo.guardarValidacion(pool, postulacion.id_postulacion, evaluarRequisitos({ meses, ultimaEvaluacion }, convocatoria));
  return modelo.obtener(pool, postulacion.id_postulacion);
};

// Criterio 1: un empleado activo se postula a una convocatoria vigente, una sola vez. Al registrarse se valida enseguida.
const postular = async (idConvocatoria, idEmpleado) => {
  const empleado = await modelo.obtenerEmpleado(pool, idEmpleado);
  if (!empleado || !empleado.activo) {
    throw new HttpError(403, 'Solo los empleados activos pueden postularse a las convocatorias internas.');
  }
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  if (convocatoria.estado !== 'ABIERTA') {
    throw conflicto(
      convocatoria.estado === 'PROGRAMADA'
        ? `La convocatoria recibe postulaciones desde el ${convocatoria.fecha_inicio_postulacion}.`
        : 'La convocatoria ya cerró: no acepta más postulaciones.',
      'CONVOCATORIA_NO_VIGENTE'
    );
  }
  if (empleado.id_cargo_actual === convocatoria.id_cargo) {
    throw conflicto(`Ya ocupa el cargo «${convocatoria.cargo}»: no puede postularse a esta convocatoria.`, 'MISMO_CARGO');
  }
  const existente = await modelo.obtenerDeEmpleado(pool, idConvocatoria, idEmpleado);
  if (existente) {
    throw conflicto('Ya se postuló a esta convocatoria: la postulación se registra una sola vez.', 'YA_POSTULADO', {
      id_postulacion: existente.id_postulacion,
    });
  }

  const idPostulacion = randomUUID();
  try {
    await modelo.insertar(pool, { id_postulacion: idPostulacion, id_convocatoria: idConvocatoria, id_empleado: idEmpleado });
  } catch (error) {
    // Dos envíos simultáneos: la restricción única deja pasar solo uno.
    if (error.code === '23505') throw conflicto('Ya se postuló a esta convocatoria: la postulación se registra una sola vez.', 'YA_POSTULADO');
    throw error;
  }
  return validar(await modelo.obtener(pool, idPostulacion), convocatoria);
};

const obtenerMia = async (idConvocatoria, idEmpleado) => {
  await obtenerConvocatoria(idConvocatoria);
  const postulacion = await modelo.obtenerDeEmpleado(pool, idConvocatoria, idEmpleado);
  if (!postulacion) throw new HttpError(404, 'Todavía no se postuló a esta convocatoria.');
  return postulacion;
};

// RRHH vuelve a validar una postulación (por ejemplo, si PerformanceService no respondía al registrarla).
const revalidar = async (idConvocatoria, idPostulacion) => {
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  const postulacion = await modelo.obtener(pool, idPostulacion);
  if (!postulacion || postulacion.id_convocatoria !== idConvocatoria) {
    throw new HttpError(404, 'No se encontró la postulación en esta convocatoria.');
  }
  if (postulacion.ascenso) {
    throw conflicto('El ascenso de este postulante ya fue formalizado: su validación no se puede repetir.', 'YA_FORMALIZADO');
  }
  return validar(postulacion, convocatoria);
};

// Criterio 4: postulaciones de la convocatoria con el ranking de aptos por puntaje de méritos. El ranking es definitivo
// cuando la convocatoria cerró; mientras sigue abierta se muestra como provisional.
const listar = async (idConvocatoria) => {
  const convocatoria = await obtenerConvocatoria(idConvocatoria);
  const postulaciones = await modelo.listarDeConvocatoria(pool, idConvocatoria);
  const deEstado = (estado) => postulaciones.filter((p) => p.estado_postulacion === estado);
  return {
    convocatoria: {
      id_convocatoria: convocatoria.id_convocatoria,
      titulo: convocatoria.titulo,
      cargo: convocatoria.cargo,
      sucursal: convocatoria.sucursal,
      estado: convocatoria.estado,
      meses_antiguedad_minima: convocatoria.meses_antiguedad_minima,
      nota_minima_desempeno: convocatoria.nota_minima_desempeno,
      fecha_cierre_postulacion: convocatoria.fecha_cierre_postulacion,
    },
    ranking_definitivo: convocatoria.estado === 'CERRADA',
    // KAN-84: la postulación cuyo ascenso se formalizó (con sus datos en `ascenso`), o null.
    ascenso_formalizado: postulaciones.find((p) => p.ascenso) ?? null,
    formula_meritos: {
      peso_nota: PESO_NOTA,
      peso_antiguedad: PESO_ANTIGUEDAD,
      meses_antiguedad_tope: MESES_ANTIGUEDAD_TOPE,
      descripcion: `${PESO_NOTA * 100} % nota de la última evaluación + ${PESO_ANTIGUEDAD * 100} % antigüedad (hasta ${MESES_ANTIGUEDAD_TOPE} meses)`,
    },
    totales: {
      postulaciones: postulaciones.length,
      aptos: deEstado(ESTADO_POSTULACION.APTO).length,
      no_aptos: deEstado(ESTADO_POSTULACION.NO_APTO).length,
      pendientes: deEstado(ESTADO_POSTULACION.PENDIENTE).length,
    },
    ranking: ordenarRanking(deEstado(ESTADO_POSTULACION.APTO)),
    no_aptos: deEstado(ESTADO_POSTULACION.NO_APTO),
    pendientes: deEstado(ESTADO_POSTULACION.PENDIENTE),
  };
};

// Para el portal del empleado: su postulación en cada convocatoria listada (o null).
const adjuntarMisPostulaciones = async (convocatorias, idEmpleado) => {
  const mias = await modelo.listarDeEmpleado(pool, idEmpleado, convocatorias.map((c) => c.id_convocatoria));
  const porConvocatoria = new Map(mias.map((p) => [p.id_convocatoria, p]));
  return convocatorias.map((c) => ({ ...c, mi_postulacion: porConvocatoria.get(c.id_convocatoria) ?? null }));
};

module.exports = { postular, obtenerMia, revalidar, listar, adjuntarMisPostulaciones };
