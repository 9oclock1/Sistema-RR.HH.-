const { Router } = require("express");
const controlador = require("../controllers/ciclosController");
const exigirRoles = require("../middlewares/exigirRoles");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

const soloAdministrador = exigirRoles(["admin"], "Solo el Administrador de RRHH puede programar ciclos de evaluación.");

// Datos para el asistente: versiones publicadas y periodos.
router.get("/ciclos/opciones", soloAdministrador, controlador.opciones);
// Calcula las asignaciones del alcance sin guardar nada.
router.post("/ciclos/vista-previa", soloAdministrador, controlador.vistaPrevia);
// Crea el ciclo y sus asignaciones. El creador viaja en X-Empleado-Id.
router.post("/ciclos", soloAdministrador, identificarEmpleado, controlador.crear);
router.get("/ciclos", soloAdministrador, controlador.listar);
// Ejecuta ahora la activación, los recordatorios y el cierre que el job hace cada día.
router.post("/ciclos/procesar", soloAdministrador, controlador.procesar);
router.get("/ciclos/:idCiclo", soloAdministrador, controlador.obtener);

module.exports = router;
