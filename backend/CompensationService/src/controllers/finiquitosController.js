const servicio = require("../services/finiquitosService");
const confirmaciones = require("../services/confirmacionesFiniquitoService");

// req.identidad viene del JWT verificado por el middleware autenticar.
async function listar(req, res) {
  res.json(await servicio.listar(req.query, req.identidad));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idProceso, req.identidad));
}

async function generar(req, res) {
  res.json(await servicio.generar(req.params.idProceso, req.identidad));
}

async function aprobar(req, res) {
  res.json(await servicio.aprobar(req.params.idProceso, req.identidad));
}

async function reenviar(req, res) {
  res.json(await servicio.reenviar(req.params.idProceso, req.body, req.identidad));
}

async function simularRespuesta(req, res) {
  res.status(202).json(await servicio.simularRespuesta(req.params.idProceso, req.body, req.identidad));
}

async function simularCaidaBroker(req, res) {
  res.json(await servicio.simularCaidaBroker(req.body, req.identidad));
}

async function descargarPdf(req, res) {
  const { nombre_archivo, contenido } = await servicio.descargarPdf(req.params.idProceso, req.identidad);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${nombre_archivo}"`,
    "Content-Length": String(contenido.length),
    "Cache-Control": "no-store",
  });
  res.send(contenido);
}

async function listarMensajesProceso(req, res) {
  res.json(await confirmaciones.listarMensajesProceso(req.params.idProceso, req.identidad));
}

async function listarMensajesEntrantes(req, res) {
  res.json(await confirmaciones.listarMensajesEntrantes(req.query, req.identidad));
}

async function reprocesarMensaje(req, res) {
  res.json(await confirmaciones.reprocesarMensaje(req.params.id, req.identidad));
}

async function simularLlegadaMensaje(req, res) {
  res.status(202).json(await confirmaciones.simularLlegada(req.body, req.identidad));
}

module.exports = {
  listar,
  obtener,
  generar,
  aprobar,
  reenviar,
  simularRespuesta,
  simularCaidaBroker,
  descargarPdf,
  listarMensajesProceso,
  listarMensajesEntrantes,
  reprocesarMensaje,
  simularLlegadaMensaje,
};
