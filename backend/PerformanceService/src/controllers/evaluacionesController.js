const servicio = require("../services/evaluacionesService");

async function listarEvaluaciones(req, res) {
  res.json(await servicio.listarEvaluaciones(req.idEmpleado, req.query));
}

async function listarCiclos(req, res) {
  res.json(await servicio.listarCiclos(req.idEmpleado));
}

async function obtenerFormulario(req, res) {
  res.json(await servicio.obtenerFormulario(req.idEmpleado, req.params.idEvaluacion));
}

async function guardarRespuestas(req, res) {
  res.json(await servicio.guardarRespuestas(req.idEmpleado, req.params.idEvaluacion, req.body));
}

async function enviar(req, res) {
  res.json(await servicio.enviar(req.idEmpleado, req.params.idEvaluacion));
}

module.exports = { listarEvaluaciones, listarCiclos, obtenerFormulario, guardarRespuestas, enviar };
