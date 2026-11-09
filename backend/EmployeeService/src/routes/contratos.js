const express = require('express');
const contratosController = require('../controllers/contratosController');
const exigirRol = require('../middlewares/exigirRol');
const { documentoContratoUpload } = require('../middlewares/documentoContratoUpload');

const router = express.Router();

router.use(exigirRol('admin', 'gerente'));

router.get('/', contratosController.listarHistorial);
router.get('/catalogos', contratosController.obtenerCatalogos);
// Versiones vigentes de todo el personal en un rango, para la planilla mensual (CompensationService).
router.get('/vigentes', contratosController.listarVigentes);
router.post('/modificaciones', documentoContratoUpload, contratosController.registrarModificacion);
router.get('/:id/documento', contratosController.descargarDocumento);

module.exports = router;
