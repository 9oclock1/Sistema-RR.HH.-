const servicio = require("../services/boletas.service");

// Temporal: el portal envía quién consulta (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

async function listar(req, res) {
  res.json(await servicio.listar(identidad(req)));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id, identidad(req)));
}

async function descargarPdf(req, res) {
  const { nombre, contenido } = await servicio.descargarPdf(req.params.id, identidad(req));
  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="${nombre}"`,
    "Cache-Control": "no-store",
  });
  res.send(contenido);
}

module.exports = { listar, obtener, descargarPdf };
