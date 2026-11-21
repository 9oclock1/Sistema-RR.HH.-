const { Router } = require("express");
const controlador = require("../controllers/desvinculacionesController");
const subirRespaldo = require("../middlewares/subirRespaldo");

const router = Router();

// Específica antes de "/:id" para que "causales" no se interprete como un id de proceso.
router.get("/desvinculaciones/causales", controlador.listarCausales);

router.get("/desvinculaciones", controlador.listar);
router.post("/desvinculaciones", subirRespaldo, controlador.registrar);
router.get("/desvinculaciones/:id", controlador.obtener);
router.get("/desvinculaciones/:id/documento", controlador.descargarDocumento);

module.exports = router;
