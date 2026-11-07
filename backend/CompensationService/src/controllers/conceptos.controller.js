const servicio = require("../services/conceptos.service");

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.body));
}

async function actualizar(req, res) {
  res.json(await servicio.actualizar(req.params.id, req.body));
}

async function cambiarEstado(req, res) {
  res.json(await servicio.cambiarEstado(req.params.id, req.body));
}

async function eliminar(req, res) {
  await servicio.eliminar(req.params.id);
  res.status(204).end();
}

async function agregarVigencia(req, res) {
  res.status(201).json(await servicio.agregarVigencia(req.params.id, req.body));
}

module.exports = { listar, obtener, crear, actualizar, cambiarEstado, eliminar, agregarVigencia };
