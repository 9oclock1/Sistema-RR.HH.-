const express = require('express');
const empleadosController = require('../controllers/empleadosController');
const supervisorController = require('../controllers/supervisorController');
const indicadoresController = require('../controllers/indicadoresController');
const exigirRol = require('../middlewares/exigirRol');

const router = express.Router();

// KPI-12 del dashboard de RRHH (épica 13). Antes de "/:id" para que "indicadores" no se lea como un id.
router.get(
  '/indicadores/rotacion-temprana',
  exigirRol('admin', 'gerente'),
  indicadoresController.obtenerRotacionTemprana
);

router.get('/:id/supervisor', supervisorController.obtenerSupervisor);

router.get('/', empleadosController.listarEmpleados);
router.get('/:id', empleadosController.obtenerResumen);
router.get('/:id/ficha', empleadosController.obtenerFicha);
router.get('/:id/memorandums', empleadosController.listarMemorandums);

module.exports = router;
