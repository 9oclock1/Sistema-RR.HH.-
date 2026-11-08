const servicio = require("../services/plantillasService");

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idPlantilla));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.idEmpleado, req.body));
}

async function actualizar(req, res) {
  res.json(await servicio.actualizar(req.params.idPlantilla, req.body));
}

async function eliminar(req, res) {
  res.json(await servicio.eliminar(req.params.idPlantilla));
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
