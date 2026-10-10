const express = require('express');
const memorandumsController = require('../controllers/memorandumsController');
const { evidenciaUpload } = require('../middlewares/evidenciaUpload');

const router = express.Router();

router.post('/', evidenciaUpload, memorandumsController.crearMemorandum);

module.exports = router;
