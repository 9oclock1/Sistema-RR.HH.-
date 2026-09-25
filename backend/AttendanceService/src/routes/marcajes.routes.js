const { Router } = require("express");
const controlador = require("../controllers/marcajes.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");
const autenticarDispositivo = require("../middlewares/autenticarDispositivo");

const router = Router();

router.get("/marcajes/jornada", identificarEmpleado, controlador.consultarJornada);
router.post("/marcajes/entrada", identificarEmpleado, controlador.registrarEntrada);
router.post("/marcajes/biometrico/entrada", autenticarDispositivo, controlador.registrarEntradaBiometrica);

module.exports = router;
