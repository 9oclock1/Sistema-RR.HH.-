const cursosService = require('../services/cursosCapacitacionService');
const { validarCurso, validarFiltrosCursos, validarId } = require('../validators/capacitacionesValidator');

const listarCursos = async (req, res) => {
  const filtros = validarFiltrosCursos(req.query);
  res.status(200).json(await cursosService.listarCursos(filtros));
};

const obtenerCurso = async (req, res) => {
  const idCurso = validarId(req.params.id);
  res.status(200).json(await cursosService.obtenerCurso(idCurso));
};

const crearCurso = async (req, res) => {
  const curso = validarCurso(req.body);
  res.status(201).json(await cursosService.crearCurso(curso));
};

const reemplazarCurso = async (req, res) => {
  const idCurso = validarId(req.params.id);
  const curso = validarCurso(req.body);
  res.status(200).json(await cursosService.reemplazarCurso(idCurso, curso));
};

const darDeBajaCurso = async (req, res) => {
  const idCurso = validarId(req.params.id);
  const curso = await cursosService.darDeBajaCurso(idCurso);
  res.status(200).json({ mensaje: 'Curso dado de baja correctamente.', curso });
};

module.exports = { listarCursos, obtenerCurso, crearCurso, reemplazarCurso, darDeBajaCurso };
