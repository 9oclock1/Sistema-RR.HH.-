const { Router } = require("express");
const controlador = require("../controllers/boletas.controller");
const autenticar = require("../middlewares/autenticar");

const router = Router();

router.get("/boletas", autenticar, controlador.listar);
router.get("/boletas/:id", autenticar, controlador.obtener);
router.get("/boletas/:id/pdf", autenticar, controlador.descargarPdf);

module.exports = router;
