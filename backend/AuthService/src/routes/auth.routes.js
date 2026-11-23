const { Router } = require("express");
const controlador = require("../controllers/auth.controller");

const router = Router();

router.post("/login", controlador.iniciarSesion);
router.post("/logout", controlador.cerrarSesion);
router.get("/sesion", controlador.obtenerSesion);

module.exports = router;
