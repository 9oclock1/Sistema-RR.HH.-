const servicio = require("../services/aprobaciones.service");

async function listarBandeja(req, res) {
  res.json(await servicio.listarBandeja(req.query));
}

async function obtenerDetalle(req, res) {
  res.json(await servicio.obtenerDetalle(req.params.categoria, req.params.idSolicitud));
}

async function resolver(req, res) {
  res.json(await servicio.resolver(req.params.categoria, req.idEmpleado, req.params.idSolicitud, req.body, { rol: req.rol }));
}

async function descargarAdjunto(req, res) {
  const { ruta, nombre, mimetype } = await servicio.obtenerAdjunto(req.params.idSolicitud, req.params.idAdjunto);
  res.type(mimetype);
  res.download(ruta, nombre);
}

module.exports = { listarBandeja, obtenerDetalle, resolver, descargarAdjunto };
