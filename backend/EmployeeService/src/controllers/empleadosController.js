const empleadosService = require('../services/empleadosService');
const { validarIdRuta } = require('../validators/comunes');

const listarEmpleados = async (req, res) => {
  res.status(200).json(await empleadosService.listarEmpleados());
};

const obtenerFicha = async (req, res) => {
  const idEmpleado = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await empleadosService.obtenerFicha(idEmpleado));
};

module.exports = { listarEmpleados, obtenerFicha };
