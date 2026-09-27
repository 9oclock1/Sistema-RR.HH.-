import { Router } from "express";
import { cvUpload } from "../middlewares/cvUploadMiddleware.js";
import { saveFile } from "../services/storageService.js";
import { v7 as uuidv7 } from "uuid";

const router = Router();

router.post("/upload-test", cvUpload.single("cv"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha proporcionado ningún archivo en el campo "cv".',
      });
    }

    const extension = req.file.originalname.split(".").pop();
    const customName = `${uuidv7()}.${extension}`;
    const result = await saveFile(req.file, customName);

    return res.status(200).json({
      success: true,
      message: "Archivo recibido y procesado correctamente.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
