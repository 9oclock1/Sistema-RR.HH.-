const { Router } = require("express");
const controlador = require("../controllers/turnos.controller");

const router = Router();

router.get("/tipos-jornada", controlador.listarTiposJornada);
router.get("/turnos", controlador.listar);
router.post("/turnos", controlador.crear);
router.get("/turnos/:id", controlador.obtener);
router.put("/turnos/:id", controlador.actualizar);
router.delete("/turnos/:id", controlador.eliminar);
router.post("/turnos/:id/evaluar-marcaje", controlador.evaluarMarcaje);

module.exports = router;
