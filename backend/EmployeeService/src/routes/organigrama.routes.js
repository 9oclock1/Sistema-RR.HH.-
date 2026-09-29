// src/routes/organigrama.routes.js
// Se monta en index.js como app.use("/organigrama", ...), por eso las rutas son relativas.
const express = require('express');
const router = express.Router();
const controller = require('../controllers/organigrama.controller');

router.get('/', controller.obtenerArbol);          // RF-20 criterios 1, 2 y 4
router.get('/exportar', controller.exportar);      // RF-20 criterio 3

module.exports = router;