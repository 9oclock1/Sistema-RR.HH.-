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

module.exports = { listarCategorias, registrar };
