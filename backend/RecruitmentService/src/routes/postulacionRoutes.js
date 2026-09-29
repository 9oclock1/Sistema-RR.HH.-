const { Router } = require("express");
const { PostulacionController } = require("../controllers/postulacionController");
const { cvUpload } = require("../middlewares/cvUploadMiddleware");

const router = Router();

router.get("/:idPostulacion/cv", PostulacionController.obtenerCv);

router.patch(
  "/:idPostulacion/cv",
  cvUpload.single("cv"),
  PostulacionController.adjuntarCv,
);

module.exports = router;
