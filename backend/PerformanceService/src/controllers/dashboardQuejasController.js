const servicio = require("../services/dashboardQuejasService");

async function obtenerDashboard(req, res) {
  res.json(await servicio.obtenerDashboard(req.query));
}

async function exportarPdf(req, res) {
  const { nombreArchivo, contenido } = await servicio.exportarPdf(req.query);
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    "Content-Length": String(contenido.length),
    "Cache-Control": "no-store",
  });
  res.send(contenido);
}

module.exports = { obtenerDashboard, exportarPdf };
