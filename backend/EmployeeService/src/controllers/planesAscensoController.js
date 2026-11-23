const planesAscensoService = require('../services/planesAscensoService');
const { validarIdRuta, normalizarUuid, lanzarSiHayErrores } = require('../validators/comunes');
const { validarAsignacionPlan, validarFormalizacion, validarFiltroEstado } = require('../validators/planesAscensoValidator');

// Quién registra la acción: X-Empleado-Id es opcional (queda null si no llega), igual que en convocatorias.
const identidad = (req) => {
  const errores = [];
  const idEmpleado = normalizarUuid(req.get('X-Empleado-Id'), 'X-Empleado-Id', {}, errores);
  lanzarSiHayErrores(errores);
  return { idEmpleado };
};

const listar = async (req, res) => {
  res.status(200).json(await planesAscensoService.listar({ estado: validarFiltroEstado(req.query.estado) }));
};

const obtener = async (req, res) => {
  res.status(200).json(await planesAscensoService.obtener(validarIdRuta(req.params.id)));
};

const asignar = async (req, res) => {
  const datos = validarAsignacionPlan(req.body);
  res.status(201).json(await planesAscensoService.asignar(datos, identidad(req)));
};

const formalizar = async (req, res) => {
  const idPlan = validarIdRuta(req.params.id);
  const datos = validarFormalizacion(req.body);
  res.status(200).json(await planesAscensoService.formalizar(idPlan, datos, identidad(req)));
};

module.exports = { listar, obtener, asignar, formalizar };
