const { Router } = require("express");
const controlador = require("../controllers/rolesTurno.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/roles-turno", controlador.listar);
router.post("/roles-turno", controlador.crear);
router.get("/roles-turno/:id", controlador.obtener);
router.put("/roles-turno/:id/asignaciones", controlador.guardarAsignaciones);
router.post("/roles-turno/:id/publicar", controlador.publicar);
router.delete("/roles-turno/:id", controlador.eliminar);
router.get("/mis-turnos", identificarEmpleado, controlador.misTurnos);

module.exports = router;
