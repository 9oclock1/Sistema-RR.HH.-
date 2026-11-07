const servicio = require("../services/catalogos.service");

async function listarEscalas(req, res) {
  res.json(await servicio.listarEscalas());
}

async function crearEscala(req, res) {
  res.status(201).json(await servicio.crearEscala(req.body));
}

async function actualizarEscala(req, res) {
  res.json(await servicio.actualizarEscala(req.params.idEscala, req.body));
}

async function eliminarEscala(req, res) {
  await servicio.eliminarEscala(req.params.idEscala);
  res.status(204).end();
}

async function listarCompetencias(req, res) {
  res.json(await servicio.listarCompetencias());
}

async function crearCompetencia(req, res) {
  res.status(201).json(await servicio.crearCompetencia(req.body));
}

module.exports = { listarEscalas, crearEscala, actualizarEscala, eliminarEscala, listarCompetencias, crearCompetencia };
