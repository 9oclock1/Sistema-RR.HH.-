const servicio = require("../services/turnos.service");

async function listar(req, res) {
  const { activo } = req.query;
  res.json(await servicio.listar(activo === undefined ? undefined : activo === "true"));
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

async function evaluarMarcaje(req, res) {
  res.json(await servicio.evaluarMarcaje(req.params.id, req.body));
}

async function listarTiposJornada(req, res) {
  res.json(await servicio.listarTiposJornada());
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  evaluarMarcaje,
  listarTiposJornada,
};
