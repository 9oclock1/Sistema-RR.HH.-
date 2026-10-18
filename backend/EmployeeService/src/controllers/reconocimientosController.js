const reconocimientosService = require('../services/reconocimientosService');
const { validarReconocimiento } = require('../validators/reconocimientosValidator');

const crearReconocimiento = async (req, res) => {
  const reconocimiento = validarReconocimiento(req.body);
  res.status(201).json(await reconocimientosService.crearReconocimiento(reconocimiento));
};

module.exports = { crearReconocimiento };
