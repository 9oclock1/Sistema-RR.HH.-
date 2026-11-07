const servicio = require("../services/notificaciones.service");

async function notificarResolucion(req, res) {
  const resultado = await servicio.notificarResolucionSolicitud(req.body);
  res.status(resultado.creada ? 201 : 200).json(resultado);
}

async function listar(req, res) {
  res.json(await servicio.listarMisNotificaciones(req.idEmpleado, req.query));
}

async function contar(req, res) {
  res.json(await servicio.contarNoLeidas(req.idEmpleado));
}

async function marcarLeida(req, res) {
  res.json(await servicio.marcarLeida(req.idEmpleado, req.params.idNotificacion));
}

async function marcarTodasLeidas(req, res) {
  res.json(await servicio.marcarTodasLeidas(req.idEmpleado));
}

module.exports = { notificarResolucion, listar, contar, marcarLeida, marcarTodasLeidas };
