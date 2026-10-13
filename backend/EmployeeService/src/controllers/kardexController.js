const kardexService = require('../services/kardexService');
const { validarIdRuta } = require('../validators/comunes');

const obtenerKardex = async (req, res) => {
  const idEmpleado = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await kardexService.obtenerKardex(idEmpleado));
};

module.exports = { obtenerKardex };
