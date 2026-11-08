const { Router } = require("express");
const controlador = require("../controllers/confirmaciones.controller");

// Confirmaciones de Contabilidad y Pagos recibidas por Pub/Sub; con ?estado=FALLIDO, la cola de mensajes fallidos.
const router = Router();

router.get("/confirmaciones", controlador.listar);
router.post("/confirmaciones/:id/reprocesar", controlador.reprocesar);

module.exports = router;
