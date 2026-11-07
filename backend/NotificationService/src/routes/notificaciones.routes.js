const { Router } = require("express");
const controlador = require("../controllers/notificaciones.controller");
const { exigirEmpleado, exigirIdentidad, exigirRol, validarParamUuid } = require("../middlewares/identificarUsuario");

const router = Router();

// RF-34: lo invoca AttendanceService cuando un supervisor resuelve una solicitud de ausencia.
router.post(
  "/notificaciones/resolucion-solicitud",
  exigirIdentidad,
  exigirRol(["admin", "gerente", "supervisor"]),
  controlador.notificarResolucion
);

// Bandeja de alertas del empleado (campana del encabezado y panel de avisos).
router.get("/notificaciones", exigirEmpleado, controlador.listar);
router.get("/notificaciones/conteo", exigirEmpleado, controlador.contar);
router.post("/notificaciones/leer-todas", exigirEmpleado, controlador.marcarTodasLeidas);
router.post(
  "/notificaciones/:idNotificacion/leer",
  exigirEmpleado,
  validarParamUuid("idNotificacion"),
  controlador.marcarLeida
);

module.exports = router;
