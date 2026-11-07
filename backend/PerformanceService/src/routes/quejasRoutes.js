const { Router } = require("express");
const controlador = require("../controllers/quejasController");
const subirAdjuntosQueja = require("../middlewares/subirAdjuntosQueja");
const identificarDenunciante = require("../middlewares/identificarDenunciante");
const erroresQuejas = require("../middlewares/erroresQuejas");
const { crearLimitador } = require("../middlewares/limitarConsultas");

const router = Router();
const limitarConsultas = crearLimitador({
  maximo: Number(process.env.QUEJAS_CONSULTAS_MAXIMO) || 10,
  ventanaMs: (Number(process.env.QUEJAS_CONSULTAS_VENTANA_MIN) || 15) * 60 * 1000,
});

router.get("/quejas/categorias", controlador.listarCategorias);
router.post("/quejas", subirAdjuntosQueja, identificarDenunciante, controlador.registrar);
router.post("/quejas/seguimiento", limitarConsultas, controlador.consultarSeguimiento);
router.use("/quejas", erroresQuejas);

module.exports = router;
