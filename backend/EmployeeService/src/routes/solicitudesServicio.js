const express = require('express');
const solicitudesController = require('../controllers/solicitudesServicioController');
const exigirRol = require('../middlewares/exigirRol');

const router = express.Router();

router.use(exigirRol('admin', 'gerente'));

router.get('/', solicitudesController.listarSolicitudes);
router.get('/:id', solicitudesController.obtenerSolicitud);
router.post('/:id/respuesta-compras', solicitudesController.registrarRespuestaCompras);

module.exports = router;
