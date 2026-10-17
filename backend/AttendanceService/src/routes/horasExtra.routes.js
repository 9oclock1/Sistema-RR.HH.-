const { Router } = require("express");
const controlador = require("../controllers/horasExtra.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/horas-extra", controlador.listar);
router.get("/horas-extra/resumen", controlador.resumen);
router.get("/horas-extra/periodos", controlador.listarPeriodos);
router.post("/horas-extra/periodos", identificarEmpleado, controlador.consolidar);

module.exports = router;
