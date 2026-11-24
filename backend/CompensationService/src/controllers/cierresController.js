const servicio = require("../services/cierresService");
const confirmaciones = require("../services/confirmacionesCierreService");

async function listar(req, res) {
  res.json(await servicio.listar(req.query, req.identidad));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idProceso, req.identidad));
}

async function cerrar(req, res) {
  res.json(await servicio.cerrar(req.params.idProceso, req.identidad));
}

async function reenviar(req, res) {
  res.json(await servicio.reenviar(req.params.idProceso, req.body, req.identidad));
}

async function simularRespuesta(req, res) {
  res.status(202).json(await servicio.simularRespuesta(req.params.idProceso, req.body, req.identidad));
}

async function configurarSinRespuesta(req, res) {
  res.json(await servicio.configurarSinRespuesta(req.body, req.identidad));
}

async function listarMensajesProceso(req, res) {
  res.json(await confirmaciones.listarMensajesProceso(req.params.idProceso, req.identidad));
}

async function reprocesarMensaje(req, res) {
  res.json(await confirmaciones.reprocesarMensaje(req.params.id, req.identidad));
}

module.exports = {
  listar,
  obtener,
  cerrar,
  reenviar,
  simularRespuesta,
  configurarSinRespuesta,
  listarMensajesProceso,
  reprocesarMensaje,
};
