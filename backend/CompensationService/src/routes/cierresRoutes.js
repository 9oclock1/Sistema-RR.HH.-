const { Router } = require("express");
const controlador = require("../controllers/cierresController");
const autenticar = require("../middlewares/autenticar");

const router = Router();

router.get("/cierres", autenticar, controlador.listar);
router.post("/cierres/simulacion/sin-respuesta", autenticar, controlador.configurarSinRespuesta);
router.get("/cierres/:idProceso", autenticar, controlador.obtener);
router.post("/cierres/:idProceso/cerrar", autenticar, controlador.cerrar);
router.post("/cierres/:idProceso/reenviar", autenticar, controlador.reenviar);
router.post("/cierres/:idProceso/simular-respuesta", autenticar, controlador.simularRespuesta);

module.exports = router;
