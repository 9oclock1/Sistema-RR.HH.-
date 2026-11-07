const { Router } = require("express");
const controlador = require("../controllers/planillas.controller");

const router = Router();

router.get("/planillas", controlador.listar);
router.post("/planillas", controlador.generar);
router.get("/planillas/:id", controlador.obtener);
router.delete("/planillas/:id", controlador.descartar);

module.exports = router;
