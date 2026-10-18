const solicitudesService = require('../services/solicitudesServicioService');
const { validarId } = require('../validators/capacitacionesValidator');
const {
  validarSolicitudCompra,
  validarRespuestaCompras,
  validarFiltrosSolicitudes,
} = require('../validators/solicitudesServicioValidator');

const solicitarCompra = async (req, res) => {
  const idCurso = validarId(req.params.id);
  const datos = validarSolicitudCompra(req.body);
  res.status(202).json(await solicitudesService.solicitarCompra(idCurso, datos));
};

const listarSolicitudes = async (req, res) => {
  const filtros = validarFiltrosSolicitudes(req.query);
  res.status(200).json(await solicitudesService.listarSolicitudes(filtros));
};

const obtenerSolicitud = async (req, res) => {
  const idSolicitud = validarId(req.params.id);
  res.status(200).json(await solicitudesService.obtenerSolicitud(idSolicitud));
};

const registrarRespuestaCompras = async (req, res) => {
  const idSolicitud = validarId(req.params.id);
  const respuesta = validarRespuestaCompras(req.body);
  res.status(200).json(await solicitudesService.registrarRespuestaCompras(idSolicitud, respuesta));
};

module.exports = { solicitarCompra, listarSolicitudes, obtenerSolicitud, registrarRespuestaCompras };
