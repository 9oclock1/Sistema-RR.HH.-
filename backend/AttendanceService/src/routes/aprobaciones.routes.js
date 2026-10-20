const { Router } = require("express");
const controlador = require("../controllers/aprobaciones.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");
const exigirResolutor = require("../middlewares/exigirResolutor");

const router = Router();

// KAN-53: bandeja de aprobaciones de vacaciones y licencias. Solo supervisores, gerentes y RRHH.
router.use("/aprobaciones", exigirResolutor);
router.get("/aprobaciones/solicitudes", controlador.listarBandeja);
router.get("/aprobaciones/solicitudes/:categoria/:idSolicitud", controlador.obtenerDetalle);
router.get("/aprobaciones/solicitudes/:categoria/:idSolicitud/adjuntos/:idAdjunto", controlador.descargarAdjunto);
router.post("/aprobaciones/solicitudes/:categoria/:idSolicitud/resolucion", identificarEmpleado, controlador.resolver);

module.exports = router;
