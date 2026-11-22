const { Router } = require("express");
const controlador = require("../controllers/reporteContable.controller");

const router = Router();

router.get("/reporte-contable/planilla/:periodo", controlador.planilla);
router.get("/reporte-contable/aguinaldo/:gestion", controlador.aguinaldo);

module.exports = router;
