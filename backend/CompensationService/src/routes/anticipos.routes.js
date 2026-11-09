const { Router } = require("express");
const controlador = require("../controllers/anticipos.controller");

const router = Router();

// Rutas específicas antes de "/:id" para que "deducciones" no se interprete como un id de préstamo.
router.get("/anticipos/deducciones", controlador.listarDeducciones);
router.post("/anticipos/deducciones/cerrar", controlador.cerrarPeriodo);

router.get("/anticipos", controlador.listar);
router.post("/anticipos", controlador.crear);
router.get("/anticipos/:id", controlador.obtener);

module.exports = router;
