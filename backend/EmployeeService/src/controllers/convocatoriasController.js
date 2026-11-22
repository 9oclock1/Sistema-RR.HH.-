const convocatoriasService = require('../services/convocatoriasService');
const { validarIdRuta } = require('../validators/comunes');

const publicar = async (req, res) => {
  res.status(201).json(await convocatoriasService.publicar(req.body, { idEmpleado: req.idEmpleado }));
};

const reintentarNotificacion = async (req, res) => {
  const idConvocatoria = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await convocatoriasService.reintentarNotificacion(idConvocatoria, { idEmpleado: req.idEmpleado }));
};

const listarGestion = async (req, res) => {
  res.status(200).json(await convocatoriasService.listarGestion(req.query));
};

const listarParaEmpleado = async (req, res) => {
  res.status(200).json(await convocatoriasService.listarParaEmpleado(req.idEmpleado, req.query));
};

const obtener = async (req, res) => {
  const idConvocatoria = validarIdRuta(req.params.id, 'id');
  res.status(200).json(
    await convocatoriasService.obtener(idConvocatoria, { esRrhh: req.esRrhh === true, idEmpleado: req.idEmpleado })
  );
};

module.exports = { publicar, reintentarNotificacion, listarGestion, listarParaEmpleado, obtener };
