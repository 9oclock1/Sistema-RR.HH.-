const { Router } = require("express");
const { CvDataController } = require("../controllers/cvDataController");

const router = Router();

router.get("/postulaciones/:id/datos-cv", CvDataController.obtenerDatosCv);
router.put("/postulaciones/:id/datos-cv", CvDataController.actualizarDatosCv);
router.post(
  "/postulaciones/:id/analizar-cv",
  CvDataController.analizarCvExistente,
);

module.exports = router;
