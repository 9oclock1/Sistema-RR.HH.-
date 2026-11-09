const servicio = require("../services/versionesService");

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idPlantilla, req.params.idVersion));
}

async function reemplazarSecciones(req, res) {
  res.json(await servicio.reemplazarSecciones(req.params.idPlantilla, req.params.idVersion, req.body));
}

async function guardarEstructura(req, res) {
  res.json(await servicio.guardarEstructura(req.params.idPlantilla, req.params.idVersion, req.body));
}

async function publicar(req, res) {
  res.json(await servicio.publicar(req.idEmpleado, req.params.idPlantilla, req.params.idVersion));
}

async function crearVersion(req, res) {
  res.status(201).json(await servicio.crearVersion(req.params.idPlantilla));
}

module.exports = { obtener, reemplazarSecciones, guardarEstructura, publicar, crearVersion };
