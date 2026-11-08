const { Router } = require("express");
const controlador = require("../controllers/evaluacionesController");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get(
  "/evaluaciones/ciclos",
  identificarEmpleado,
  controlador.listarCiclos,
);
// KAN-26: resultados del colaborador evaluado (solo lectura). Van antes de /evaluaciones/:idEvaluacion.
router.get(
  "/evaluaciones/mis-resultados",
  identificarEmpleado,
  controlador.listarMisResultados,
);
router.get(
  "/evaluaciones/mis-resultados/:idEvaluacion",
  identificarEmpleado,
  controlador.obtenerMiResultado,
);
// Historial consolidado de un colaborador (RBAC: el propio, o cualquiera si el rol es de RRHH).
router.get(
  "/evaluaciones/historial/:idEmpleado",
  identificarEmpleado,
  controlador.obtenerHistorialDesempeno,
);
router.get(
  "/evaluaciones",
  identificarEmpleado,
  controlador.listarEvaluaciones,
);
router.get(
  "/evaluaciones/:idEvaluacion",
  identificarEmpleado,
  controlador.obtenerFormulario,
);
router.put(
  "/evaluaciones/:idEvaluacion/respuestas",
  identificarEmpleado,
  controlador.guardarRespuestas,
);
router.post(
  "/evaluaciones/:idEvaluacion/envio",
  identificarEmpleado,
  controlador.enviar,
);
router.put(
  "/evaluaciones/:idEvaluacion/retroalimentacion",
  identificarEmpleado,
  controlador.guardarRetroalimentacion,
);

module.exports = router;
