const { Router } = require("express");
const controlador = require("../controllers/dashboardConflictividadController");
const exigirRoles = require("../middlewares/exigirRoles");

const router = Router();

// RF-72/RF-73 (KAN-506): KPI-03 (índice de quejas) y KPI-06 (minutos de atraso) por área y sucursal.
// El Administrador de RRHH ve toda la empresa; el Supervisor, solo la suya (esa restricción la aplica
// Asistencia al resolver /reportes/asistencia, ver services/asistenciaExterna.js).
const puedeConsultar = exigirRoles(
  ["admin", "gerente", "supervisor"],
  "Solo el Administrador de RRHH o el Supervisor de sucursal pueden consultar este dashboard.",
);

router.get("/dashboards/conflictividad", puedeConsultar, controlador.obtenerDashboard);

module.exports = router;
