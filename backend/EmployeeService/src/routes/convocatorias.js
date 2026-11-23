const express = require('express');
const convocatoriasController = require('../controllers/convocatoriasController');
const postulacionesController = require('../controllers/postulacionesController');
const exigirRol = require('../middlewares/exigirRol');
const identificarEmpleado = require('../middlewares/identificarEmpleado');
const { autenticar, exigirRolSesion } = require('../middlewares/autenticar');

const router = express.Router();

router.get('/gestion', autenticar, exigirRolSesion('admin', 'gerente'), convocatoriasController.listarGestion);
router.post('/', autenticar, exigirRolSesion('admin'), convocatoriasController.publicar);
router.post('/:id/notificacion', autenticar, exigirRolSesion('admin'), convocatoriasController.reintentarNotificacion);

router.get('/', autenticar, convocatoriasController.listarParaEmpleado);
router.get('/:id', autenticar, convocatoriasController.obtener);

// KAN-81: postulación del empleado y validación de méritos; RRHH revisa el ranking y puede volver a validar.
router.post('/:id/postulaciones', identificarEmpleado, postulacionesController.postular);
router.get('/:id/postulaciones/mia', identificarEmpleado, postulacionesController.obtenerMia);
router.get('/:id/postulaciones', exigirRol('admin', 'gerente'), postulacionesController.listar);
router.post('/:id/postulaciones/:idPostulacion/validacion', exigirRol('admin'), postulacionesController.revalidar);

module.exports = router;
