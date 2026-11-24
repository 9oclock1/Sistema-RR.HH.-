const servicio = require("../services/dashboardAsistencia.service");

// Temporal: el portal envía quién consulta (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim().toLowerCase() || null,
  rol: req.get("X-Rol")?.trim().toLowerCase() || null,
});

// RF-73 (KAN-93): KPI-04 (ausentismo) y KPI-05 (puntualidad) con semáforo, comparativo por sucursal y, con
// una sola sucursal en el alcance, el detalle diario de faltas y atrasos.
async function asistencia(req, res) {
  res.json(await servicio.generar(req.query, identidad(req)));
}

module.exports = { asistencia };
