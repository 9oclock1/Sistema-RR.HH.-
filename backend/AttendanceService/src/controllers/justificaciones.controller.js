const servicio = require("../services/justificaciones.service");

async function motivos(req, res) {
  res.json(await servicio.listarMotivos());
}

async function misNovedades(req, res) {
  res.json(await servicio.misNovedades(req.idEmpleado, req.query));
}

async function registrar(req, res) {
  res.status(201).json(await servicio.registrar(req.idEmpleado, req.body, req.files));
}

module.exports = { motivos, misNovedades, registrar };
