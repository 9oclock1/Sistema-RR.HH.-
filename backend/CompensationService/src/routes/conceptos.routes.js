const { Router } = require("express");
const controlador = require("../controllers/conceptos.controller");

const router = Router();

router.get("/conceptos", controlador.listar);
router.post("/conceptos", controlador.crear);
router.get("/conceptos/:id", controlador.obtener);
router.put("/conceptos/:id", controlador.actualizar);
router.patch("/conceptos/:id/estado", controlador.cambiarEstado);
router.delete("/conceptos/:id", controlador.eliminar);
router.post("/conceptos/:id/vigencias", controlador.agregarVigencia);

module.exports = router;
