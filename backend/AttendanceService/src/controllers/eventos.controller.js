const servicio = require("../services/eventos.service");

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function confirmar(req, res) {
  res.json(await servicio.confirmar(req.params.id));
}

module.exports = { listar, confirmar };
