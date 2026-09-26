const express = require('express');
const convocatoriasController = require('../controllers/convocatoriasController');

const router = express.Router();

router.get('/', convocatoriasController.listarConvocatorias);
router.get('/niveles-educacion', convocatoriasController.listarNivelesEducacion);
router.get('/perfil-cargo/:idCargo', convocatoriasController.obtenerPerfilCargo);
router.get('/:id', convocatoriasController.obtenerConvocatoria);
router.post('/', convocatoriasController.crearConvocatoria);
router.patch('/:id', convocatoriasController.actualizarConvocatoria);
router.post('/:id/publicar', convocatoriasController.publicarConvocatoria);
router.post('/:id/cerrar', convocatoriasController.cerrarConvocatoria);

module.exports = router;
