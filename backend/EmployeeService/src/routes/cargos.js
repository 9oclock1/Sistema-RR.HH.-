const express = require('express');
const cargosController = require('../controllers/cargosController');

const router = express.Router();

router.get('/', cargosController.listarCargos); 
router.get('/:id', cargosController.obtenerCargo);
router.post('/', cargosController.crearCargo); 
router.put('/:id', cargosController.reemplazarCargo); 

module.exports = router;
