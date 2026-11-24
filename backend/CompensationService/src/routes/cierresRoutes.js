const { Router } = require("express");
const controlador = require("../controllers/cierresController");
const autenticar = require("../middlewares/autenticar");

const router = Router();

router.get("/cierres", autenticar, controlador.listar);
router.get("/cierres/:idProceso", autenticar, controlador.obtener);
router.post("/cierres/:idProceso/cerrar", autenticar, controlador.cerrar);

module.exports = router;
