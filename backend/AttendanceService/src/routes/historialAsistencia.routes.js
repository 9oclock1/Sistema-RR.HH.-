const { Router } = require("express");
const controlador = require("../controllers/historialAsistencia.controller");

const router = Router();

router.get("/empleados/:idEmpleado/historial-asistencia", controlador.historial);

module.exports = router;
