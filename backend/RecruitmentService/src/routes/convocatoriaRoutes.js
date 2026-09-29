const { Router } = require("express");
const { ConvocatoriaController } = require("../controllers/convocatoriaController");

const router = Router();

// El listado de convocatorias es GET /convocatorias de RF-08.
router.get(
  "/:idConvocatoria/postulantes",
  ConvocatoriaController.listarPostulantes,
);

module.exports = router;
