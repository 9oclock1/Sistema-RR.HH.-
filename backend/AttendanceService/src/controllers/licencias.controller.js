const servicio = require("../services/licencias.service");

async function listarTipos(req, res) {
  res.json(await servicio.listarTipos());
}

async function listarMisSolicitudes(req, res) {
  res.json(await servicio.listarMisSolicitudes(req.idEmpleado));
}

async function radicar(req, res) {
  res.status(201).json(await servicio.radicar(req.idEmpleado, req.body, req.files));
}

async function descargarAdjunto(req, res) {
  const { ruta, nombre, mimetype } = await servicio.obtenerAdjunto(
    req.idEmpleado,
    req.params.idSolicitud,
    req.params.idAdjunto
  );
  res.type(mimetype);
  res.download(ruta, nombre);
}

module.exports = { listarTipos, listarMisSolicitudes, radicar, descargarAdjunto };
