const empleadosService = require('../services/empleadosService');
const { validarIdRuta, normalizarUuid, lanzarSiHayErrores } = require('../validators/comunes');

const listarEmpleados = async (req, res) => {
  const errores = [];
  const idSucursal = normalizarUuid(req.query.id_sucursal, 'id_sucursal', {}, errores);
  const idDepartamento = normalizarUuid(req.query.id_departamento, 'id_departamento', {}, errores);
  lanzarSiHayErrores(errores);
  res.status(200).json(await empleadosService.listarEmpleados({ idSucursal, idDepartamento }));
};

const obtenerFicha = async (req, res) => {
  const idEmpleado = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await empleadosService.obtenerFicha(idEmpleado));
};

const obtenerResumen = async (req, res) => {
  const idEmpleado = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await empleadosService.obtenerResumen(idEmpleado));
};

const listarMemorandums = async (req, res) => {
  const idEmpleado = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await empleadosService.listarMemorandums(idEmpleado));
};

module.exports = { listarEmpleados, obtenerFicha, obtenerResumen, listarMemorandums };
