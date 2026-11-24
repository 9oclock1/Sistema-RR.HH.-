const { Router } = require("express");
const controlador = require("../controllers/finiquitosController");
const autenticar = require("../middlewares/autenticar");

const router = Router();

router.get("/finiquitos", autenticar, controlador.listar);
router.get("/finiquitos/:idProceso", autenticar, controlador.obtener);
router.post("/finiquitos/:idProceso/generar", autenticar, controlador.generar);
router.post("/finiquitos/:idProceso/aprobar", autenticar, controlador.aprobar);
router.get("/finiquitos/:idProceso/pdf", autenticar, controlador.descargarPdf);

module.exports = router;
