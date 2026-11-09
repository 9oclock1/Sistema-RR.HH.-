const servicio = require("../services/ventasProductividad.service");

async function listarReglas(req, res) {
  res.json(await servicio.listarReglas(req.query));
}

async function obtenerRegla(req, res) {
  res.json(await servicio.obtenerRegla(req.params.id));
}

async function crearRegla(req, res) {
  res.status(201).json(await servicio.crearRegla(req.body));
}

async function actualizarRegla(req, res) {
  res.json(await servicio.actualizarRegla(req.params.id, req.body));
}

async function cambiarEstadoRegla(req, res) {
  res.json(await servicio.cambiarEstadoRegla(req.params.id, req.body));
}

async function eliminarRegla(req, res) {
  await servicio.eliminarRegla(req.params.id);
  res.status(204).end();
}

async function procesar(req, res) {
  res.json(await servicio.procesar(req.body));
}

async function listarBonos(req, res) {
  res.json(await servicio.listarBonos(req.query));
}

async function listarEventos(req, res) {
  res.json(await servicio.listarEventos(req.query));
}

async function reprocesarEvento(req, res) {
  res.json(await servicio.reprocesarEvento(req.params.id));
}

module.exports = {
  listarReglas,
  obtenerRegla,
  crearRegla,
  actualizarRegla,
  cambiarEstadoRegla,
  eliminarRegla,
  procesar,
  listarBonos,
  listarEventos,
  reprocesarEvento,
};
