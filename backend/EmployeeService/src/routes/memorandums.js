const express = require('express');
const memorandumsController = require('../controllers/memorandumsController');
const acusesMemorandumController = require('../controllers/acusesMemorandumController');
const { evidenciaUpload } = require('../middlewares/evidenciaUpload');
const identificarEmpleado = require('../middlewares/identificarEmpleado');

const router = express.Router();

router.post('/', evidenciaUpload, memorandumsController.crearMemorandum);
router.get('/tipos', memorandumsController.listarTipos);

// RF-39: portal del colaborador (memorándums emitidos a su nombre) y seguimiento de acuses para RRHH.
router.get('/recibidos', identificarEmpleado, acusesMemorandumController.listarRecibidos);
router.get('/recibidos/:id', identificarEmpleado, acusesMemorandumController.abrirRecibido);
router.post('/recibidos/:id/acuse', identificarEmpleado, acusesMemorandumController.acusarRecibo);
router.get('/seguimiento', acusesMemorandumController.listarSeguimiento);

router.get('/:id/pdf', memorandumsController.descargarPdf);

module.exports = router;
