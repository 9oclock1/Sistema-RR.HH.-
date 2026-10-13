const express = require('express');
const kardexController = require('../controllers/kardexController');
const exigirRol = require('../middlewares/exigirRol');

const router = express.Router();

router.get('/:id/kardex', exigirRol('admin', 'gerente'), kardexController.obtenerKardex);

module.exports = router;
