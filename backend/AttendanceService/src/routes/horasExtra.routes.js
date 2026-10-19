const { Router } = require("express");
const controlador = require("../controllers/horasExtra.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/horas-extra", controlador.listar);
router.get("/horas-extra/resumen", controlador.resumen);
router.get("/horas-extra/periodos", controlador.listarPeriodos);
router.post("/horas-extra/periodos", identificarEmpleado, controlador.consolidar);
router.get("/horas-extra/autorizaciones", controlador.listarAutorizaciones);
router.post("/horas-extra/autorizaciones", identificarEmpleado, controlador.autorizar);
router.delete("/horas-extra/autorizaciones/:idAutorizacion", identificarEmpleado, controlador.eliminarAutorizacion);
router.patch("/horas-extra/:idHorasJornada", identificarEmpleado, controlador.revisar);

module.exports = router;
