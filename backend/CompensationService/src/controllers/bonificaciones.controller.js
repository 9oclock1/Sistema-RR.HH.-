const servicio = require("../services/bonificaciones.service");

// Temporal: el portal envía quién actúa (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

function enviar(res, resultado) {
  if (resultado && typeof resultado === "object" && "contenido" in resultado) {
    res.set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${resultado.nombre}"`,
      "Cache-Control": "private, no-store",
    });
    return res.send(resultado.contenido);
  }
  return res.json(resultado);
}

async function historial(req, res) {
  enviar(res, await servicio.historial(req.query, req.params.idEmpleado, identidad(req)));
}

async function historialPorSucursal(req, res) {
  enviar(res, await servicio.historialPorSucursal({ ...req.query, sucursal: req.params.sucursal }, identidad(req)));
}

async function auditoria(req, res) {
  enviar(res, await servicio.auditoria(req.query, identidad(req)));
}

module.exports = { historial, historialPorSucursal, auditoria };
