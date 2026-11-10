const { Router } = require("express");
const controlador = require("../controllers/ventasProductividad.controller");

const router = Router();

// Rutas específicas antes de "/bonos-productividad/:id" para no confundir "bonos"/"eventos" con un id.
router.get("/bonos-productividad/bonos", controlador.listarBonos);
router.post("/bonos-productividad/procesar", controlador.procesar);
router.get("/bonos-productividad/eventos", controlador.listarEventos);
router.post("/bonos-productividad/eventos/:id/reprocesar", controlador.reprocesarEvento);
router.get("/bonos-productividad/solicitudes-cierre", controlador.obtenerSolicitudCierre);
router.post("/bonos-productividad/solicitudes-cierre", controlador.solicitarCierre);

router.get("/bonos-productividad", controlador.listarReglas);
router.post("/bonos-productividad", controlador.crearRegla);
router.get("/bonos-productividad/:id", controlador.obtenerRegla);
router.put("/bonos-productividad/:id", controlador.actualizarRegla);
router.patch("/bonos-productividad/:id/estado", controlador.cambiarEstadoRegla);
router.delete("/bonos-productividad/:id", controlador.eliminarRegla);

module.exports = router;
