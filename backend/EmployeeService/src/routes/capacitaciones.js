const express = require('express');
const capacitacionesController = require('../controllers/capacitacionesController');
const exigirRol = require('../middlewares/exigirRol');
const { certificadoUpload } = require('../middlewares/certificadoUpload');

const router = express.Router();

router.use(exigirRol('admin', 'gerente'));

router.get('/', capacitacionesController.listarCapacitaciones);
router.get('/:id', capacitacionesController.obtenerCapacitacion);
router.post('/', certificadoUpload, capacitacionesController.registrarCapacitacion);
router.put('/:id', capacitacionesController.reemplazarCapacitacion);
router.delete('/:id', capacitacionesController.eliminarCapacitacion);
router.get('/:id/certificado', capacitacionesController.descargarCertificado);
router.put('/:id/certificado', certificadoUpload, capacitacionesController.reemplazarCertificado);
router.delete('/:id/certificado', capacitacionesController.quitarCertificado);

module.exports = router;
