const { Router } = require("express");
const controlador = require("../controllers/escalasController");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

// Escalas de valoración: catálogo común a todas las plantillas.
router.get("/escalas", identificarEmpleado, controlador.listar);
router.post("/escalas", identificarEmpleado, controlador.crear);
router.put("/escalas/:idEscala", identificarEmpleado, controlador.actualizar);
router.delete("/escalas/:idEscala", identificarEmpleado, controlador.eliminar);

module.exports = router;
