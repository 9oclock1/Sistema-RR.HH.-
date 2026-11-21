const { Router } = require("express");
const controlador = require("../controllers/boletas.controller");

const router = Router();

router.get("/boletas", controlador.listar);
router.get("/boletas/:id", controlador.obtener);
router.get("/boletas/:id/pdf", controlador.descargarPdf);

module.exports = router;
