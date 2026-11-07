const servicio = require("../services/sucursalQuejaService");

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idQueja));
}

async function registrar(req, res) {
  res.json(await servicio.registrar({ idQueja: req.params.idQueja, cuerpo: req.body ?? {} }));
}

module.exports = { obtener, registrar };
