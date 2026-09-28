// src/routes/jerarquia.routes.js
// Se monta en index.js como app.use("/jerarquia", ...)
const express = require('express');
const router = express.Router();
const controller = require('../controllers/jerarquia.controller');

router.get('/cargos', controller.listarCargos);                        // selector y listado
router.get('/cargos/:id/subordinados', controller.listarSubordinados); // RF-18 criterio 3
router.get('/cargos/:id/historial', controller.listarHistorial);       // RF-18 criterio 4
router.put('/cargos/:id/superior', controller.asignarSuperior);        // RF-18 criterios 1, 2 y 4

module.exports = router;