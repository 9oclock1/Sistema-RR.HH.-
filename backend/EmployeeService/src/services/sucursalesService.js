const pool = require('../../db/pool');
const sucursalesModel = require('../models/sucursalesModel');

const listarSucursales = () => sucursalesModel.listarActivas(pool);

module.exports = { listarSucursales };
