const servicio = require("../services/desempenoService");
const consumidor = require("../services/consumidorCrmService");

async function listarCiclos(req, res) {
  res.json(await servicio.listarCiclos());
}

async function obtenerConsolidado(req, res) {
  res.json(await servicio.obtenerConsolidado(req.params.idCiclo));
}

async function obtenerComparativa(req, res) {
  res.json(await servicio.obtenerComparativa(req.params.idCiclo, req.query));
}

async function obtenerColaboradores(req, res) {
  res.json(await servicio.obtenerColaboradores(req.params.idCiclo, req.query));
}

async function actualizarUmbral(req, res) {
  res.json(await servicio.actualizarUmbral(req.params.idCiclo, req.body));
}

async function reintentarSolicitudCrm(req, res) {
  res.json(await servicio.reintentarSolicitudCrm(req.params.idCiclo));
}

async function listarMensajesCrm(req, res) {
  res.json(await consumidor.listarMensajes(req.query));
}

async function reprocesarMensajeCrm(req, res) {
  res.json(await consumidor.reprocesarMensaje(req.params.idMensaje));
}

async function simularMensajeCrm(req, res) {
  const recibido = await consumidor.simularLlegada(req.body);
  res.status(recibido.duplicado ? 200 : 202).json(recibido);
}

module.exports = {
  listarCiclos,
  obtenerConsolidado,
  obtenerComparativa,
  obtenerColaboradores,
  actualizarUmbral,
  reintentarSolicitudCrm,
  listarMensajesCrm,
  reprocesarMensajeCrm,
  simularMensajeCrm,
};
