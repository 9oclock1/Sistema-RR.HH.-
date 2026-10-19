const { Router } = require("express");
const controlador = require("../controllers/novedades.controller");

const router = Router();

router.get("/panel-asistencia", controlador.panel);

module.exports = router;
