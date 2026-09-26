const service = require('../services/departamentos.service');
const { validarDepartamento, validarIdDepartamento } = require('../validators/departamentosValidator');

const listarActivas = async (req, res) => {
  res.status(200).json(await service.listarAreasActivas());
};

const crear = async (req, res) => {
  const datos = validarDepartamento(req.body);
  res.status(201).json(await service.registrarArea(datos));
};

const actualizar = async (req, res) => {
  const id = validarIdDepartamento(req.params.id);
  const datos = validarDepartamento(req.body);
  res.status(200).json(await service.modificarArea(id, datos));
};

const darDeBaja = async (req, res) => {
  const id = validarIdDepartamento(req.params.id);
  const area = await service.darDeBajaArea(id);
  res.status(200).json({ mensaje: 'Área dada de baja correctamente.', area });
};

module.exports = { crear, listarActivas, actualizar, darDeBaja };
