const express = require('express');
const sucursalesController = require('../controllers/sucursalesController');

const router = express.Router();

router.get('/', sucursalesController.listarSucursales);

module.exports = router;
