import { Router } from "express";
import { ConvocatoriaController } from "../controllers/convocatoriaController.js";

const router = Router();

router.get("/", ConvocatoriaController.listar);
router.get(
  "/:idConvocatoria/postulantes",
  ConvocatoriaController.listarPostulantes,
);

export default router;
