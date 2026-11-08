const { Router } = require("express");
const controlador = require("../controllers/competenciasController");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/competencias", identificarEmpleado, controlador.listar);
router.post("/competencias", identificarEmpleado, controlador.crear);

module.exports = router;
