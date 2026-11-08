const servicio = require("../services/competenciasService");

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.body));
}

module.exports = { listar, crear };
