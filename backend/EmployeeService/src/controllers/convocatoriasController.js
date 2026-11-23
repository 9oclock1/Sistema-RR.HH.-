const convocatoriasService = require('../services/convocatoriasService');
const { validarIdRuta } = require('../validators/comunes');

const publicar = async (req, res) => {
  res.status(201).json(await convocatoriasService.publicar(req.body, { idEmpleado: req.identidad.idEmpleado }));
};

const reintentarNotificacion = async (req, res) => {
  const idConvocatoria = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await convocatoriasService.reintentarNotificacion(idConvocatoria, { idEmpleado: req.identidad.idEmpleado }));
};

const listarGestion = async (req, res) => {
  res.status(200).json(await convocatoriasService.listarGestion(req.query));
};

const listarParaEmpleado = async (req, res) => {
  res.status(200).json(await convocatoriasService.listarParaEmpleado(req.identidad.idEmpleado, req.query));
};

const obtener = async (req, res) => {
  const idConvocatoria = validarIdRuta(req.params.id, 'id');
  res.status(200).json(
    await convocatoriasService.obtener(idConvocatoria, req.identidad)
  );
};

module.exports = { publicar, reintentarNotificacion, listarGestion, listarParaEmpleado, obtener };
