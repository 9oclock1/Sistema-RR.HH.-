const servicio = require("../services/condiciones.service");

async function listar(req, res) {
  res.json(await servicio.listar());
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

async function eliminar(req, res) {
  await servicio.eliminar(req.params.id);
  res.status(204).end();
}

async function listarBonos(req, res) {
  res.json(await servicio.listarBonos(req.query));
}

async function procesar(req, res) {
  res.json(await servicio.procesar(req.body));
}

module.exports = { listar, obtener, crear, actualizar, eliminar, listarBonos, procesar };
