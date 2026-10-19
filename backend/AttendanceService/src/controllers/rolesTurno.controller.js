const servicio = require("../services/rolesTurno.service");

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.body));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id));
}

async function guardarAsignaciones(req, res) {
  res.json(await servicio.guardarAsignaciones(req.params.id, req.body));
}

async function publicar(req, res) {
  res.json(await servicio.publicar(req.params.id));
}

async function eliminar(req, res) {
  await servicio.eliminar(req.params.id);
  res.status(204).end();
}

async function misTurnos(req, res) {
  res.json(await servicio.misTurnos(req.idEmpleado, req.query));
}

module.exports = { listar, crear, obtener, guardarAsignaciones, publicar, eliminar, misTurnos };
