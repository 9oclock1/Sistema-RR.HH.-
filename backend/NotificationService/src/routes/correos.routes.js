const { Router } = require("express");
const controlador = require("../controllers/correos.controller");
const { exigirServicio } = require("../middlewares/identificarServicio");

const router = Router();

// RF-15: lo invoca RecruitmentService para avisar al candidato de su entrevista (programada, reprogramada o cancelada).
router.post("/correos/entrevistas", exigirServicio(["recruitment-service"]), controlador.enviarAvisoEntrevista);

module.exports = router;
