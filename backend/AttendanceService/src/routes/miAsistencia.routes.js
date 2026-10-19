const { Router } = require("express");
const controlador = require("../controllers/miAsistencia.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

// RF-28: historial de asistencia individual (?mes=AAAA-MM o ?desde&hasta).
router.get("/mi-asistencia", identificarEmpleado, controlador.consultar);

module.exports = router;
