const { Router } = require("express");
const controlador = require("../controllers/planillasFiscales.controller");

const router = Router();

router.get("/parametros-tributarios", controlador.listarParametros);
router.get("/creditos-fiscales", controlador.listarCreditos);
router.put("/creditos-fiscales", controlador.registrarCredito);

router.post("/planillas/:id/tributaria", controlador.generarTributaria);
router.get("/planillas/:id/tributaria", controlador.obtenerTributaria);
router.get("/planillas/:id/tributaria/exportacion", controlador.exportarTributaria);

router.post("/planillas/:id/aportes", controlador.generarAportes);
router.get("/planillas/:id/aportes", controlador.obtenerAportes);
router.get("/planillas/:id/aportes/exportacion", controlador.exportarAportes);

module.exports = router;
