import { Router } from "express";
import { PostulacionController } from "../controllers/postulacionController.js";
import { cvUpload } from "../middlewares/cvUploadMiddleware.js";

const router = Router();

router.post("/", cvUpload.single("cv"), PostulacionController.crear);

export default router;
