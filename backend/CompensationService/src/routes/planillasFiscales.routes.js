const { Router } = require("express");
const controlador = require("../controllers/planillasFiscales.controller");
const autenticar = require("../middlewares/autenticar");

const router = Router();

router.get("/parametros-tributarios", autenticar, controlador.listarParametros);
router.get("/creditos-fiscales", autenticar, controlador.listarCreditos);
router.put("/creditos-fiscales", autenticar, controlador.registrarCredito);

router.post("/planillas/:id/tributaria", autenticar, controlador.generarTributaria);
router.get("/planillas/:id/tributaria", autenticar, controlador.obtenerTributaria);
router.get("/planillas/:id/tributaria/exportacion", autenticar, controlador.exportarTributaria);

router.post("/planillas/:id/aportes", autenticar, controlador.generarAportes);
router.get("/planillas/:id/aportes", autenticar, controlador.obtenerAportes);
router.get("/planillas/:id/aportes/exportacion", autenticar, controlador.exportarAportes);

module.exports = router;
