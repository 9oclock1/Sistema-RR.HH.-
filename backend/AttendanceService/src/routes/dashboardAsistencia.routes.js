const { Router } = require("express");
const controlador = require("../controllers/dashboardAsistencia.controller");

const router = Router();

// RF-73 (KAN-93): dashboard de ausentismo y puntualidad por sucursal (KPI-04/KPI-05). Las sucursales/áreas que
// puede filtrar quien consulta ya las expone /reportes/asistencia/alcance (mismo rol, misma restricción, RF-29).
router.get("/dashboards/asistencia", controlador.asistencia);

module.exports = router;
