const servicio = require("../services/cierresService");

async function listar(req, res) {
  res.json(await servicio.listar(req.query, req.identidad));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idProceso, req.identidad));
}

async function cerrar(req, res) {
  res.json(await servicio.cerrar(req.params.idProceso, req.identidad));
}

module.exports = { listar, obtener, cerrar };
