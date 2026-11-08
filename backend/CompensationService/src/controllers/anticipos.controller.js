const servicio = require("../services/anticipos.service");

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.body));
}

async function listarDeducciones(req, res) {
  res.json(await servicio.listarDeducciones(req.query.periodo));
}

async function cerrarPeriodo(req, res) {
  res.json(await servicio.cerrarPeriodo(req.body.periodo));
}

module.exports = { listar, obtener, crear, listarDeducciones, cerrarPeriodo };
