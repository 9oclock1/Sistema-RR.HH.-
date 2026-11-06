const { Router } = require("express");
const controlador = require("../controllers/condiciones.controller");

const router = Router();

router.get("/condiciones/bonos", controlador.listarBonos);
router.post("/condiciones/procesar", controlador.procesar);
router.get("/condiciones", controlador.listar);
router.post("/condiciones", controlador.crear);
router.get("/condiciones/:id", controlador.obtener);
router.put("/condiciones/:id", controlador.actualizar);
router.delete("/condiciones/:id", controlador.eliminar);

module.exports = router;
