const { Router } = require("express");
const controlador = require("../controllers/plantillasController");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/plantillas", identificarEmpleado, controlador.listar);
router.post("/plantillas", identificarEmpleado, controlador.crear);
router.get("/plantillas/:idPlantilla", identificarEmpleado, controlador.obtener);
router.put("/plantillas/:idPlantilla", identificarEmpleado, controlador.actualizar);
router.delete("/plantillas/:idPlantilla", identificarEmpleado, controlador.eliminar);

module.exports = router;
