const servicio = require("../services/ciclosService");

async function opciones(req, res) {
  res.json(await servicio.opciones());
}

async function vistaPrevia(req, res) {
  res.json(await servicio.vistaPrevia(req.body));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.idEmpleado, req.body));
}

async function listar(req, res) {
  res.json(await servicio.listar());
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idCiclo));
}

module.exports = { opciones, vistaPrevia, crear, listar, obtener };
