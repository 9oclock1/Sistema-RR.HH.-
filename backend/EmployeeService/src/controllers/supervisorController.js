const supervisorService = require('../services/supervisorService');
const { validarIdRuta } = require('../validators/comunes');

const obtenerSupervisor = async (req, res) => {
  const idEmpleado = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await supervisorService.obtenerSupervisor(idEmpleado));
};

module.exports = { obtenerSupervisor };
