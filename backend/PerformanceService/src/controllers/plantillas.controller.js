const servicio = require("../services/plantillas.service");

async function listar(req, res) {
  res.json(await servicio.listar());
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idVersion));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.idEmpleado, req.body));
}

async function actualizar(req, res) {
  res.json(await servicio.actualizar(req.params.idVersion, req.body));
}

async function eliminar(req, res) {
  await servicio.eliminar(req.params.idVersion);
  res.status(204).end();
}

async function publicar(req, res) {
  res.json(await servicio.publicar(req.idEmpleado, req.params.idVersion));
}

async function crearVersion(req, res) {
  const { plantilla, creada } = await servicio.crearVersion(req.params.idVersion);
  res.status(creada ? 201 : 200).json(plantilla);
}

module.exports = { listar, obtener, crear, actualizar, eliminar, publicar, crearVersion };
