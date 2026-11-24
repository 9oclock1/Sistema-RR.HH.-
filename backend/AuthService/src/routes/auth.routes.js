const { Router } = require("express");
const controlador = require("../controllers/auth.controller");
const exigirServicioInterno = require("../middlewares/exigirServicioInterno");

const router = Router();

router.post("/login", controlador.iniciarSesion);
router.post("/logout", controlador.cerrarSesion);
router.get("/sesion", controlador.obtenerSesion);
router.post("/usuarios/:idEmpleado/revocar", exigirServicioInterno, controlador.revocarAcceso);
router.get("/usuarios/:idEmpleado/acceso", exigirServicioInterno, controlador.consultarAcceso);

module.exports = router;
