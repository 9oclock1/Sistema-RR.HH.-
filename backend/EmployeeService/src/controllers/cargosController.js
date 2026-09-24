const cargosService = require('../services/cargosService');
const { validarCargo, validarIdCargo, validarFiltroArea } = require('../validators/cargosValidator');


const listarCargos = async (req, res) => {
  const idDepartamento = validarFiltroArea(req.query.area_id);
  res.status(200).json(await cargosService.listarCargos(idDepartamento));
};

const obtenerCargo = async (req, res) => {
  const idCargo = validarIdCargo(req.params.id);
  res.status(200).json(await cargosService.obtenerCargo(idCargo));
};

const crearCargo = async (req, res) => {
  const cargo = validarCargo(req.body);
  res.status(201).json(await cargosService.crearCargo(cargo));
};

const reemplazarCargo = async (req, res) => {
  const idCargo = validarIdCargo(req.params.id);
  const cargo = validarCargo(req.body);
  res.status(200).json(await cargosService.reemplazarCargo(idCargo, cargo));
};

module.exports = { listarCargos, obtenerCargo, crearCargo, reemplazarCargo };
