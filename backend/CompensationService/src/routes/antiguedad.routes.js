const { Router } = require("express");
const controlador = require("../controllers/antiguedad.controller");

const router = Router();

// Rutas específicas antes de "/antiguedad/bono/:idEmpleado" para no confundir "escalas" con un id.
router.get("/antiguedad/escalas", controlador.listarEscalas);
router.get("/antiguedad/escalas/vigente", controlador.obtenerEscalaVigente);
router.post("/antiguedad/escalas", controlador.registrarVigencia);

router.get("/antiguedad/bono", controlador.calcularBonoPlanilla);
router.get("/antiguedad/bono/:idEmpleado", controlador.calcularBono);

module.exports = router;
