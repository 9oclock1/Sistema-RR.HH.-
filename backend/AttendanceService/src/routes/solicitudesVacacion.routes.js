const { Router } = require("express");
const controlador = require("../controllers/solicitudesVacacion.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/vacaciones/solicitudes/resumen", identificarEmpleado, controlador.consultarSaldo);
router.get("/vacaciones/solicitudes/calculo", identificarEmpleado, controlador.calcular);
router.get("/vacaciones/solicitudes", identificarEmpleado, controlador.listarSolicitudes);
router.post("/vacaciones/solicitudes", identificarEmpleado, controlador.registrarSolicitud);

module.exports = router;
