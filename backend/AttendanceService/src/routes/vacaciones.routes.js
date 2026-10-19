const { Router } = require("express");
const controlador = require("../controllers/vacaciones.controller");
const identificarEmpleado = require("../middlewares/identificarEmpleado");

const router = Router();

router.get("/vacaciones/saldo", identificarEmpleado, controlador.miSaldo);
// Consulta de RRHH sobre el expediente de un empleado.
router.get("/vacaciones/empleados/:idEmpleado/saldo", controlador.saldoDeEmpleado);

module.exports = router;
