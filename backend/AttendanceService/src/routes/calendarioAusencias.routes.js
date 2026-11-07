const { Router } = require("express");
const controlador = require("../controllers/calendarioAusencias.controller");

const router = Router();

// RF-35: calendario consolidado de ausencias aprobadas. El control de rol vive en el servicio, que además
// limita al supervisor a su sucursal.
router.get("/calendario/ausencias/alcance", controlador.alcance);
router.get("/calendario/ausencias", controlador.consultar);
router.get("/calendario/umbrales", controlador.listarUmbrales);
router.put("/calendario/umbrales", controlador.guardarUmbral);
router.delete("/calendario/umbrales/:idUmbral", controlador.eliminarUmbral);

module.exports = router;
