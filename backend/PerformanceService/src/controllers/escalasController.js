const servicio = require("../services/escalasService");

async function listar(req, res) {
  res.json(await servicio.listarEscalas());
}

async function crear(req, res) {
  res.status(201).json(await servicio.crearEscala(req.body));
}

async function actualizar(req, res) {
  res.json(await servicio.actualizarEscala(req.params.idEscala, req.body));
}

async function eliminar(req, res) {
  await servicio.eliminarEscala(req.params.idEscala);
  res.status(204).end();
}

module.exports = { listar, crear, actualizar, eliminar };
