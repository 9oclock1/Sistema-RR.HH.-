const servicio = require("../services/historialQuejaService");

async function listarCatalogos(req, res) {
  res.json(await servicio.listarCatalogos());
}

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function exportar(req, res) {
  const { nombreArchivo, contenido, total } = await servicio.exportar(req.query);
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    "Cache-Control": "no-store",
    "X-Total-Casos": String(total),
  });
  res.send(contenido);
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idQueja));
}

module.exports = { listarCatalogos, listar, exportar, obtener };
