const { Router } = require("express");
const controlador = require("../controllers/reportes.controller");

const router = Router();

// RF-29: reportes de asistencia por sucursal y área.
router.get("/reportes/asistencia/alcance", controlador.alcance);
router.get("/reportes/asistencia", controlador.asistencia);

module.exports = router;
