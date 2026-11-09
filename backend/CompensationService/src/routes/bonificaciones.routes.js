const { Router } = require("express");
const controlador = require("../controllers/bonificaciones.controller");

// RF-53: historial de bonos por colaborador (Kardex) y auditoría de altas, modificaciones y anulaciones.
// ?formato=csv descarga el resultado en vez de devolver JSON.
const router = Router();

router.get("/bonificaciones/auditoria", controlador.auditoria);
router.get("/bonificaciones/empleados/:idEmpleado", controlador.historial);

module.exports = router;
