const express = require('express');
const empleadosController = require('../controllers/empleadosController');

const router = express.Router();

router.get('/', empleadosController.listarEmpleados);
router.get('/:id/ficha', empleadosController.obtenerFicha);

module.exports = router;
