import { Router } from "express";
import { PostulacionController } from "../controllers/postulacionController.js";
import { cvUpload } from "../middlewares/cvUploadMiddleware.js";
import { CvDataController } from "../controllers/cvDataController.js";

const router = Router();

router.get("/:idPostulacion/cv", PostulacionController.obtenerCv);

router.patch(
  "/:idPostulacion/cv",
  cvUpload.single("cv"),
  PostulacionController.adjuntarCv,
);
router.get(":id/datos-cv", CvDataController.obtenerDatosCv);
router.put(":id/datos-cv", CvDataController.actualizarDatosCv);

export default router;
