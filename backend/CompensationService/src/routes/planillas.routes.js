const { Router } = require("express");
const controlador = require("../controllers/planillas.controller");

const router = Router();

router.get("/planillas", controlador.listar);
router.post("/planillas", controlador.generar);
router.get("/planillas/:id", controlador.obtener);
router.delete("/planillas/:id", controlador.descartar);
router.post("/planillas/:id/aprobar", controlador.aprobar);
router.post("/planillas/:id/integraciones/:destino/reenviar", controlador.reenviar);
// Contabilidad y Pagos no existen en este sistema: su confirmación se simula desde la pantalla, publicando
// de verdad en Pub/Sub (ver planillas.service.js#simularConfirmacion). Lo usa el botón "Simular aceptación"
// del reporte contable (RF-49, KAN-69) para poder cerrar una planilla aprobada.
router.post("/planillas/:id/integraciones/:destino/simular-confirmacion", controlador.simularConfirmacion);

module.exports = router;
