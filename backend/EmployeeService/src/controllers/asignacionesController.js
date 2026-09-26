const asignacionesService = require('../services/asignacionesService');
const { validarAsignacion } = require('../validators/asignacionesValidator');

const crearAsignacion = async (req, res) => {
  const asignacion = validarAsignacion(req.body);
  res.status(201).json(await asignacionesService.crearAsignacion(asignacion));
};

module.exports = { crearAsignacion };
