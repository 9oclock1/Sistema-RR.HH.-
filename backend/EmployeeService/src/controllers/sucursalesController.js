const sucursalesService = require('../services/sucursalesService');

const listarSucursales = async (req, res) => {
  res.status(200).json(await sucursalesService.listarSucursales());
};

module.exports = { listarSucursales };
