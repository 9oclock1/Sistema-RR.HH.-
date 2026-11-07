const { Router } = require("express");
const controlador = require("../controllers/licencias.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");
const exigirResolutor = require("../middlewares/exigirResolutor");
const { subirComprobantes } = require("../middlewares/subirComprobantes");

const router = Router();

router.get("/licencias/tipos", controlador.listarTipos);
router.get("/licencias/solicitudes", identificarEmpleado, controlador.listarMisSolicitudes);
router.post("/licencias/solicitudes", identificarEmpleado, subirComprobantes, controlador.radicar);
router.post("/licencias/solicitudes/:idSolicitud/resolucion", identificarEmpleado, exigirResolutor, controlador.resolver);
router.get("/licencias/solicitudes/:idSolicitud/adjuntos/:idAdjunto", identificarEmpleado, controlador.descargarAdjunto);

module.exports = router;
