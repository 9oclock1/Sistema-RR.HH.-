const { Router } = require("express");
const controlador = require("../controllers/entrevistaController");
const identificarReclutador = require("../middlewares/identificarReclutador");

const router = Router();

router.get("/entrevistas", controlador.listarAgenda);
router.get("/entrevistas/:id", controlador.obtenerDetalle);
router.patch("/entrevistas/:id/reprogramar", identificarReclutador, controlador.reprogramar);
router.patch("/entrevistas/:id/cancelar", identificarReclutador, controlador.cancelar);
router.post("/notificaciones-entrevista/:id/reintentar", identificarReclutador, controlador.reintentarNotificacion);
router.get("/postulaciones/:id/entrevistas", controlador.listarDePostulacion);
router.post("/postulaciones/:id/entrevistas", identificarReclutador, controlador.agendar);

module.exports = router;
