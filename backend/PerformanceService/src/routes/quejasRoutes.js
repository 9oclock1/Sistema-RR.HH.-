const { Router } = require("express");
const controlador = require("../controllers/quejasController");
const subirAdjuntosQueja = require("../middlewares/subirAdjuntosQueja");
const identificarDenunciante = require("../middlewares/identificarDenunciante");
const erroresQuejas = require("../middlewares/erroresQuejas");

const router = Router();

router.get("/quejas/categorias", controlador.listarCategorias);
router.post("/quejas", subirAdjuntosQueja, identificarDenunciante, controlador.registrar);
router.use("/quejas", erroresQuejas);

module.exports = router;
