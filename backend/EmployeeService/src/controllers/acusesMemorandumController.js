const acusesMemorandumService = require('../services/acusesMemorandumService');
const { validarAcuse, validarEstadoAcuse } = require('../validators/acusesMemorandumValidator');
const { validarIdRuta } = require('../validators/comunes');
const HttpError = require('../utils/HttpError');

// IP del colaborador; detrás del gateway llega en X-Forwarded-For (ver 'trust proxy' en index.js).
const ipCliente = (req) => {
  const ip = (req.ip || req.socket?.remoteAddress || '').replace(/^::ffff:/, '');
  if (!ip) throw new HttpError(400, 'No se pudo determinar la dirección IP de la petición.');
  return ip;
};

const listarRecibidos = async (req, res) => {
  res.status(200).json(await acusesMemorandumService.listarRecibidos(req.idEmpleado));
};

const abrirRecibido = async (req, res) => {
  const idMemorandum = validarIdRuta(req.params.id, 'id');
  res.status(200).json(await acusesMemorandumService.abrirRecibido(req.idEmpleado, idMemorandum));
};

const acusarRecibo = async (req, res) => {
  const idMemorandum = validarIdRuta(req.params.id, 'id');
  const { comentario } = validarAcuse(req.body);
  const acuse = await acusesMemorandumService.acusarRecibo({
    idEmpleado: req.idEmpleado,
    idUsuario: req.idUsuario,
    idMemorandum,
    ip: ipCliente(req),
    comentario,
  });
  res.status(200).json(acuse);
};

const listarSeguimiento = async (req, res) => {
  const estadoAcuse = validarEstadoAcuse(req.query.estado_acuse);
  res.status(200).json(await acusesMemorandumService.listarSeguimiento(estadoAcuse));
};

module.exports = { listarRecibidos, abrirRecibido, acusarRecibo, listarSeguimiento };
