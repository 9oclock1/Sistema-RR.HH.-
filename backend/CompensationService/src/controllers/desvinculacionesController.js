const servicio = require("../services/desvinculacionesService");

// Temporal: el portal envía quién actúa (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

async function listarCausales(req, res) {
  res.json(await servicio.listarCausales(identidad(req)));
}

async function listar(req, res) {
  res.json(await servicio.listar(req.query, identidad(req)));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id, identidad(req)));
}

async function descargarDocumento(req, res) {
  const doc = await servicio.obtenerDocumento(req.params.id, identidad(req));
  res.set({
    "Content-Type": doc.tipo_mime,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.nombre_archivo)}`,
    "Cache-Control": "private, no-store",
  });
  res.send(doc.contenido);
}

async function registrar(req, res) {
  const creado = await servicio.registrar(req.body, req.file, identidad(req));
  res.status(201).json(creado);
}

module.exports = { listarCausales, listar, obtener, descargarDocumento, registrar };
