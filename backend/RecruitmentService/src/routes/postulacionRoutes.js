import { Router } from "express";
import { PostulacionController } from "../controllers/postulacionController.js";
import { cvUpload } from "../middlewares/cvUploadMiddleware.js";

const router = Router();

router.get("/:idPostulacion/cv", PostulacionController.obtenerCv);

router.patch(
  "/:idPostulacion/cv",
  cvUpload.single("cv"),
  PostulacionController.adjuntarCv,
);

export default router;
