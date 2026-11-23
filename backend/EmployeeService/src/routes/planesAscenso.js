const express = require('express');
const planesAscensoController = require('../controllers/planesAscensoController');
const exigirRol = require('../middlewares/exigirRol');

// KAN-83: seguimiento del plan de capacitación previo al ascenso. Lo consultan RRHH y la gerencia; asignar planes y
// formalizar ascensos es del Administrador de RRHH.
const router = express.Router();

router.get('/', exigirRol('admin', 'gerente'), planesAscensoController.listar);
router.get('/:id', exigirRol('admin', 'gerente'), planesAscensoController.obtener);
router.post('/', exigirRol('admin'), planesAscensoController.asignar);
router.post('/:id/formalizacion', exigirRol('admin'), planesAscensoController.formalizar);

module.exports = router;
