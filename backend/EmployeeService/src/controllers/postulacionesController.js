const postulacionesService = require('../services/postulacionesService');
const { validarIdRuta } = require('../validators/comunes');

const postular = async (req, res) => {
  const idConvocatoria = validarIdRuta(req.params.id, 'id');
  res.status(201).json(await postulacionesService.postular(idConvocatoria, req.idEmpleado));
};

const obtenerMia = async (req, res) => {
  const idConvocatoria = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await postulacionesService.obtenerMia(idConvocatoria, req.idEmpleado));
};

const listar = async (req, res) => {
  res.status(200).json(await postulacionesService.listar(validarIdRuta(req.params.id, 'id')));
};

const revalidar = async (req, res) => {
  const idConvocatoria = validarIdRuta(req.params.id, 'id');
  const idPostulacion = validarIdRuta(req.params.idPostulacion, 'idPostulacion');
  res.status(200).json(await postulacionesService.revalidar(idConvocatoria, idPostulacion));
};

module.exports = { postular, obtenerMia, listar, revalidar };
