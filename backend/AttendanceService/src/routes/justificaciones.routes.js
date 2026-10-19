const { Router } = require("express");
const controlador = require("../controllers/justificaciones.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");
const subirJustificativo = require("../middlewares/subirJustificativo");

const router = Router();

router.get("/justificaciones/motivos", controlador.motivos);
router.get("/mis-novedades", identificarEmpleado, controlador.misNovedades);
router.post("/justificaciones", identificarEmpleado, subirJustificativo, controlador.registrar);
router.get("/justificaciones", controlador.bandeja);
router.get("/justificaciones/:idSolicitud", controlador.obtener);
router.get("/justificaciones/:idSolicitud/adjuntos/:idAdjunto", controlador.adjunto);
router.patch("/justificaciones/:idSolicitud", identificarEmpleado, controlador.revisar);

module.exports = router;
