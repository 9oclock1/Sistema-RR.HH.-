const servicio = require("../services/boletas.service");

// req.identidad viene del JWT verificado por el middleware autenticar, no de cabeceras que envía el cliente.

async function listar(req, res) {
  res.json(await servicio.listar(req.identidad));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id, req.identidad));
}

async function descargarPdf(req, res) {
  const { nombre, contenido } = await servicio.descargarPdf(req.params.id, req.identidad);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${nombre}"`,
    "Cache-Control": "no-store",
  });
  res.send(contenido);
}

module.exports = { listar, obtener, descargarPdf };
