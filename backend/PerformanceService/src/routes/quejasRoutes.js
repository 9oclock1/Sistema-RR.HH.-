const { Router } = require("express");
const controlador = require("../controllers/quejasController");
const casos = require("../controllers/casosQuejaController");
const subirAdjuntosQueja = require("../middlewares/subirAdjuntosQueja");
const identificarDenunciante = require("../middlewares/identificarDenunciante");
const identificarEmpleado = require("../middlewares/identificarEmpleado");
const exigirAdministrador = require("../middlewares/exigirAdministrador");
const erroresQuejas = require("../middlewares/erroresQuejas");
const { crearLimitador } = require("../middlewares/limitarConsultas");

const router = Router();
const limitarConsultas = crearLimitador({
  maximo: Number(process.env.QUEJAS_CONSULTAS_MAXIMO) || 10,
  ventanaMs: (Number(process.env.QUEJAS_CONSULTAS_VENTANA_MIN) || 15) * 60 * 1000,
});
const administrador = [exigirAdministrador, identificarEmpleado];

router.get("/quejas/categorias", controlador.listarCategorias);
router.post("/quejas", subirAdjuntosQueja, identificarDenunciante, controlador.registrar);
router.post("/quejas/seguimiento", limitarConsultas, controlador.consultarSeguimiento);

router.get("/quejas/catalogos", exigirAdministrador, casos.listarCatalogos);
router.get("/quejas/responsables", exigirAdministrador, casos.listarResponsables);
router.get("/quejas/casos", exigirAdministrador, casos.listarCasos);
router.get("/quejas/casos/:idQueja", exigirAdministrador, casos.obtenerCaso);
router.put("/quejas/casos/:idQueja/clasificacion", exigirAdministrador, casos.clasificar);
router.post("/quejas/casos/:idQueja/involucrados", administrador, casos.registrarInvolucrado);
router.delete("/quejas/casos/:idQueja/involucrados/:idEmpleado", exigirAdministrador, casos.quitarInvolucrado);
router.post("/quejas/casos/:idQueja/derivacion", administrador, casos.derivar);
router.post("/quejas/casos/:idQueja/derivacion/notificacion", administrador, casos.reintentarAviso);
router.use("/quejas", erroresQuejas);

module.exports = router;
