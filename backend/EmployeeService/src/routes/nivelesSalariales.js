const express = require('express');
const nivelesSalarialesController = require('../controllers/nivelesSalarialesController');

const router = express.Router();

router.get('/', nivelesSalarialesController.listarNiveles); 

module.exports = router;
