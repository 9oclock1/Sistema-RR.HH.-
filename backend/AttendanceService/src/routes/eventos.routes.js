const { Router } = require("express");
const controlador = require("../controllers/eventos.controller");

const router = Router();

router.get("/eventos", controlador.listar);
router.post("/eventos/:id/confirmar", controlador.confirmar);

module.exports = router;
