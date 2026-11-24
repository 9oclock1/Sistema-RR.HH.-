const servicio = require("../services/dashboardConflictividadService");

async function obtenerDashboard(req, res) {
  const identidad = { idEmpleado: req.get("X-Empleado-Id")?.trim().toLowerCase() || null, rol: req.rol };
  res.json(await servicio.obtenerDashboard(req.query, identidad));
}

module.exports = { obtenerDashboard };
