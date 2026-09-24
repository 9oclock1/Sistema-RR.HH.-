const nivelesSalarialesService = require('../services/nivelesSalarialesService');

const listarNiveles = async (req, res) => {
  res.status(200).json(await nivelesSalarialesService.listarNiveles());
};

module.exports = { listarNiveles };
