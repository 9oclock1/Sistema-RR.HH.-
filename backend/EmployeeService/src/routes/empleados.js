const express = require('express');
const empleadosController = require('../controllers/empleadosController');
const supervisorController = require('../controllers/supervisorController');

const router = express.Router();

router.get('/:id/supervisor', supervisorController.obtenerSupervisor);

router.get('/', empleadosController.listarEmpleados);
router.get('/:id', empleadosController.obtenerResumen);
router.get('/:id/ficha', empleadosController.obtenerFicha);

module.exports = router;
