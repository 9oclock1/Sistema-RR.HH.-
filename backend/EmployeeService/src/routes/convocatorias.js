const express = require('express');
const convocatoriasController = require('../controllers/convocatoriasController');
const exigirRol = require('../middlewares/exigirRol');
const identificarEmpleado = require('../middlewares/identificarEmpleado');
const { identificarLector, leerEmpleadoOpcional } = require('../middlewares/accesoConvocatorias');

const router = express.Router();

router.get('/gestion', exigirRol('admin', 'gerente'), convocatoriasController.listarGestion);
router.post('/', exigirRol('admin'), leerEmpleadoOpcional, convocatoriasController.publicar);
router.post('/:id/notificacion', exigirRol('admin'), leerEmpleadoOpcional, convocatoriasController.reintentarNotificacion);

router.get('/', identificarEmpleado, convocatoriasController.listarParaEmpleado);
router.get('/:id', identificarLector, convocatoriasController.obtener);

module.exports = router;
