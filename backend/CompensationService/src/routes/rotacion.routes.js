const { Router } = require("express");
const controlador = require("../controllers/rotacion.controller");
const autenticar = require("../middlewares/autenticar");

const router = Router();

// Dashboard de rotación de personal (RF-75): KPI-10, KPI-11 y KPI-12 con tendencia y motivos de baja. Exige sesión.
router.get("/indicadores/rotacion", autenticar, controlador.obtenerTablero);

module.exports = router;
