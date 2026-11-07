const pool = require('../../db/pool');
const cursosModel = require('../models/cursosCapacitacionModel');
const HttpError = require('../utils/HttpError');
const { withTransaction } = require('../utils/transaction');

const noEncontrado = () => new HttpError(404, 'El curso solicitado no existe.');

const codigoDuplicado = (codigo) => {
  const mensaje = `Ya existe un curso con el código «${codigo}».`;
  return new HttpError(409, mensaje, { campos_faltantes: [], errores: [{ campo: 'codigo', mensaje }] });
};

const listarCursos = (filtros) => cursosModel.listar(pool, filtros);

const obtenerCurso = async (idCurso) => {
  const curso = await cursosModel.obtenerPorId(pool, idCurso);
  if (!curso) throw noEncontrado();
  return curso;
};

const crearCurso = (curso) =>
  withTransaction(async (client) => {
    if (await cursosModel.existeCodigo(client, curso.codigo)) throw codigoDuplicado(curso.codigo);
    const idCurso = await cursosModel.insertar(client, curso);
    return cursosModel.obtenerPorId(client, idCurso);
  });

const reemplazarCurso = (idCurso, curso) =>
  withTransaction(async (client) => {
    const actual = await cursosModel.bloquearPorId(client, idCurso);
    if (!actual) throw noEncontrado();
    if (!actual.esta_activo) throw new HttpError(409, 'No se puede modificar un curso dado de baja.');
    if (await cursosModel.existeCodigo(client, curso.codigo, idCurso)) throw codigoDuplicado(curso.codigo);

    await cursosModel.reemplazar(client, idCurso, curso);
    return cursosModel.obtenerPorId(client, idCurso);
  });

const darDeBajaCurso = (idCurso) =>
  withTransaction(async (client) => {
    const actual = await cursosModel.bloquearPorId(client, idCurso);
    if (!actual) throw noEncontrado();
    if (!actual.esta_activo) throw new HttpError(409, 'El curso ya está dado de baja.');

    await cursosModel.darDeBaja(client, idCurso);
    return cursosModel.obtenerPorId(client, idCurso);
  });

module.exports = { listarCursos, obtenerCurso, crearCurso, reemplazarCurso, darDeBajaCurso };
