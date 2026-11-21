const { Router } = require("express");
const controlador = require("../controllers/desvinculacionesController");
const promedio = require("../controllers/promedioIndemnizableController");
const exigirAdmin = require("../middlewares/exigirAdmin");
const subirRespaldo = require("../middlewares/subirRespaldo");

const router = Router();

// Específica antes de "/:id" para que "causales" no se interprete como un id de proceso.
router.get("/desvinculaciones/causales", controlador.listarCausales);

router.get("/desvinculaciones", controlador.listar);
router.post("/desvinculaciones", exigirAdmin, subirRespaldo, controlador.registrar);
router.get("/desvinculaciones/:id", controlador.obtener);
router.get("/desvinculaciones/:id/documento", controlador.descargarDocumento);
router.post("/desvinculaciones/:id/promedio-indemnizable", promedio.calcular);

module.exports = router;
