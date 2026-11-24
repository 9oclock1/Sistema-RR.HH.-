const servicio = require("../services/finiquitosService");

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

module.exports = {
  listar,
  obtener,
  generar,
  aprobar,
  descargarPdf,
};
