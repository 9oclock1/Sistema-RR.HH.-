const express = require('express');
const router = express.Router();
const cargosController = require('../controllers/cargosController');

router.get('/', cargosController.obtenerCargos);
router.post('/', cargosController.crearCargo);

module.exports = router;


