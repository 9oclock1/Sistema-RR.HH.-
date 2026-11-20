const { Router } = require("express");
const controlador = require("../controllers/aguinaldo.controller");

const router = Router();

router.get("/aguinaldos", controlador.listar);
router.post("/aguinaldos", controlador.generar);
router.get("/aguinaldos/:id", controlador.obtener);
router.delete("/aguinaldos/:id", controlador.descartar);
router.post("/aguinaldos/:id/aprobar", controlador.aprobar);
router.post("/aguinaldos/:id/integraciones/:destino/reenviar", controlador.reenviar);
// Contabilidad y Pagos no existen en este sistema: su confirmación se simula desde la pantalla en vez de
// esperarla por Pub/Sub (criterio 4), igual de válida para el flujo que una confirmación real.
router.post("/aguinaldos/:id/integraciones/:destino/simular-confirmacion", controlador.simularConfirmacion);

module.exports = router;
