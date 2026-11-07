const servicio = require("../services/quejasService");

async function listarCategorias(req, res) {
  res.json(await servicio.listarCategorias());
}

async function registrar(req, res) {
  const queja = await servicio.registrarQueja({
    cuerpo: req.body ?? {},
    archivos: req.files ?? [],
    idEmpleado: req.idEmpleado,
  });
  res.status(201).json(queja);
}

async function consultarSeguimiento(req, res) {
  res.json(await servicio.consultarSeguimiento(req.body ?? {}));
}

module.exports = { listarCategorias, registrar, consultarSeguimiento };
