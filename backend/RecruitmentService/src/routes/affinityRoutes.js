const { Router } = require("express");
const { AffinityController } = require("../controllers/affinityController");

const router = Router();

router.get(
  "/postulaciones/:id/afinidad",
  AffinityController.obtenerDesgloseAfinidad,
);

router.post(
  "/postulaciones/:id/recalcular-afinidad",
  AffinityController.recalcularAfinidadPostulacion,
);

router.post(
  "/convocatorias/:id/recalcular-afinidad",
  AffinityController.recalcularAfinidadConvocatoria,
);

module.exports = router;
