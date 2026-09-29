import { Router } from "express";
import { CvDataController } from "../controllers/cvDataController.js";

const router = Router();

router.get("/postulaciones/:id/datos-cv", CvDataController.obtenerDatosCv);
router.put("/postulaciones/:id/datos-cv", CvDataController.actualizarDatosCv);
router.post(
  "/postulaciones/:id/analizar-cv",
  CvDataController.analizarCvExistente,
);

export default router;
