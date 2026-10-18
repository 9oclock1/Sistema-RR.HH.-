const express = require('express');
const cursosController = require('../controllers/cursosCapacitacionController');
const solicitudesController = require('../controllers/solicitudesServicioController');
const exigirRol = require('../middlewares/exigirRol');

const router = express.Router();

router.use(exigirRol('admin', 'gerente'));

router.get('/', cursosController.listarCursos);
router.get('/:id', cursosController.obtenerCurso);
router.post('/', cursosController.crearCurso);
router.put('/:id', cursosController.reemplazarCurso);
router.patch('/:id/baja', cursosController.darDeBajaCurso);
router.post('/:id/solicitar-compra', solicitudesController.solicitarCompra);

module.exports = router;
