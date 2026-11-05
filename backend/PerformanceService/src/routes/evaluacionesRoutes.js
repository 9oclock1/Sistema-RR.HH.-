const { Router } = require("express");
const controlador = require("../controllers/evaluacionesController");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get(
  "/evaluaciones/ciclos",
  identificarEmpleado,
  controlador.listarCiclos,
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

module.exports = router;
