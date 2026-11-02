const { Router } = require("express");
const controlador = require("../controllers/plantillas.controller");

const router = Router();

router.get("/plantillas", controlador.listar);
router.post("/plantillas", controlador.crear);
router.get("/plantillas/:id", controlador.obtener);
router.put("/plantillas/:id", controlador.actualizar);
router.delete("/plantillas/:id", controlador.eliminar);
router.post("/plantillas/:id/publicar", controlador.publicar);
router.post("/plantillas/:id/versiones", controlador.crearVersion);

module.exports = router;
