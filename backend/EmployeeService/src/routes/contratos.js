const express = require('express');
const contratosController = require('../controllers/contratosController');
const exigirRol = require('../middlewares/exigirRol');
const { documentoContratoUpload } = require('../middlewares/documentoContratoUpload');

const router = express.Router();

router.use(exigirRol('admin', 'gerente'));

router.get('/', contratosController.listarHistorial);
router.get('/catalogos', contratosController.obtenerCatalogos);
router.post('/modificaciones', documentoContratoUpload, contratosController.registrarModificacion);
router.get('/:id/documento', contratosController.descargarDocumento);

module.exports = router;
