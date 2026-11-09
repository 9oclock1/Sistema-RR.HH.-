const servicio = require("../services/antiguedad.service");

async function listarEscalas(req, res) {
  res.json(await servicio.listarEscalas());
}

async function obtenerEscalaVigente(req, res) {
  res.json(await servicio.obtenerEscalaVigente(req.query.fecha));
}

async function registrarVigencia(req, res) {
  res.status(201).json(await servicio.registrarVigencia(req.body));
}

async function calcularBono(req, res) {
  res.json(await servicio.calcularBono(req.params.idEmpleado, req.query.periodo));
}

async function calcularBonoPlanilla(req, res) {
  res.json(await servicio.calcularBonoPlanilla(req.query.periodo));
}

module.exports = { listarEscalas, obtenerEscalaVigente, registrarVigencia, calcularBono, calcularBonoPlanilla };
