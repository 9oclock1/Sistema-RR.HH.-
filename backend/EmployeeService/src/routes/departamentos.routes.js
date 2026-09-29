// routes/departamentos.routes.js
const express = require('express');
const controller = require('../controllers/departamentos.controller');

const router = express.Router();

router.get('/', controller.listarActivas);      
router.post('/', controller.crear);            
router.put('/:id', controller.actualizar);        
router.patch('/:id/baja', controller.darDeBaja);  

module.exports = router;
