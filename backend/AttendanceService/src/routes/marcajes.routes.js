const { Router } = require("express");
const controlador = require("../controllers/marcajes.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/marcajes/jornada", identificarEmpleado, controlador.consultarJornada);
router.post("/marcajes/entrada", identificarEmpleado, controlador.registrarEntrada);

module.exports = router;
