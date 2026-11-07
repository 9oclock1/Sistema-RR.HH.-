const { Router } = require("express");
const controlador = require("../controllers/licenciasPlanilla.controller");

const router = Router();

// Licencias aprobadas de todo el personal, para la planilla mensual (CompensationService).
router.get("/licencias/aprobadas", controlador.listarAprobadas);

module.exports = router;
