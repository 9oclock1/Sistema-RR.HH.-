const pool = require('../../db/pool');
const nivelesSalarialesModel = require('../models/nivelesSalarialesModel');

const listarNiveles = () => nivelesSalarialesModel.listar(pool);

module.exports = { listarNiveles };
