// routes/departamentos.routes.js
const express = require('express');
const router = express.Router();
const controller = require('../controllers/departamentos.controller');

router.post('/departamentos', controller.crear);              // RF-16 criterio 1
router.get('/departamentos', controller.listarActivas);        // selector / listado activas
router.put('/departamentos/:id', controller.actualizar);       // RF-16 criterio 2
router.patch('/departamentos/:id/baja', controller.darDeBaja); // RF-16 criterios 3 y 4

module.exports = router;