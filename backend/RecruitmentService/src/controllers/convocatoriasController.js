const convocatoriasService = require('../services/convocatoriasService');
const { NIVELES_EDUCACION } = require('../utils/nivelesEducacion');
const {
  validarCreacion,
  validarEdicion,
  validarIdConvocatoria,
  validarIdCargo,
  validarFiltroEstado,
} = require('../validators/convocatoriasValidator');

const listarConvocatorias = async (req, res) => {
  const estado = validarFiltroEstado(req.query.estado);
  res.status(200).json(await convocatoriasService.listarConvocatorias(estado));
};

const obtenerConvocatoria = async (req, res) => {
  const idConvocatoria = validarIdConvocatoria(req.params.id);
  res.status(200).json(await convocatoriasService.obtenerConvocatoria(idConvocatoria));
};

const listarNivelesEducacion = (req, res) => {
  res.status(200).json(NIVELES_EDUCACION);
};

const obtenerPerfilCargo = async (req, res) => {
  const idCargo = validarIdCargo(req.params.idCargo);
  res.status(200).json(await convocatoriasService.obtenerPerfilDesdeCargo(idCargo));
};

const crearConvocatoria = async (req, res) => {
  const convocatoria = validarCreacion(req.body);
  res.status(201).json(await convocatoriasService.crearConvocatoria(convocatoria));
};

const actualizarConvocatoria = async (req, res) => {
  const idConvocatoria = validarIdConvocatoria(req.params.id);
  const cambios = validarEdicion(req.body);
  res.status(200).json(await convocatoriasService.actualizarConvocatoria(idConvocatoria, cambios));
};

const publicarConvocatoria = async (req, res) => {
  const idConvocatoria = validarIdConvocatoria(req.params.id);
  res.status(200).json(await convocatoriasService.publicarConvocatoria(idConvocatoria));
};

const cerrarConvocatoria = async (req, res) => {
  const idConvocatoria = validarIdConvocatoria(req.params.id);
  res.status(200).json(await convocatoriasService.cerrarConvocatoria(idConvocatoria));
};

module.exports = {
  listarConvocatorias,
  obtenerConvocatoria,
  listarNivelesEducacion,
  obtenerPerfilCargo,
  crearConvocatoria,
  actualizarConvocatoria,
  publicarConvocatoria,
  cerrarConvocatoria,
};
