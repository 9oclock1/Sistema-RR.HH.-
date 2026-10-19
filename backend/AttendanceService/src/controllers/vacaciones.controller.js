const servicio = require("../services/vacaciones.service");

async function consultarSaldo(req, res) {
  res.json(await servicio.consultarSaldo(req.idEmpleado));
}

async function listarSolicitudes(req, res) {
  res.json(await servicio.listarSolicitudes(req.idEmpleado));
}

async function calcular(req, res) {
  res.json(await servicio.calcular(req.idEmpleado, req.query));
}

async function registrarSolicitud(req, res) {
  res.status(201).json(await servicio.registrarSolicitud(req.idEmpleado, req.body));
}

module.exports = { consultarSaldo, listarSolicitudes, calcular, registrarSolicitud };
