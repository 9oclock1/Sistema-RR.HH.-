const express = require('express');
const asignacionesController = require('../controllers/asignacionesController');

const router = express.Router();

router.post('/', asignacionesController.crearAsignacion);

module.exports = router;
