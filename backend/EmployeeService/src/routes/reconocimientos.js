const express = require('express');
const reconocimientosController = require('../controllers/reconocimientosController');

const router = express.Router();

router.post('/', reconocimientosController.crearReconocimiento);

module.exports = router;
