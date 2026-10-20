const { Router } = require("express");
const controlador = require("../controllers/etapaPostulacionController");
const identificarReclutador = require("../middlewares/identificarReclutador");

const router = Router();

router.get("/etapas-postulacion", controlador.obtenerCatalogo);
router.get("/convocatorias/:id/pipeline", controlador.obtenerPipeline);
router.post(
  "/integraciones/:id/reintentar",
  identificarReclutador,
  controlador.reintentarIntegracion,
);
router.get("/postulaciones/:id/historial-etapas", controlador.obtenerHistorial);
router.get("/postulaciones/:id/integraciones", controlador.obtenerIntegraciones);
router.patch(
  "/postulaciones/:id/etapa",
  identificarReclutador,
  controlador.cambiarEtapa,
);

module.exports = router;
