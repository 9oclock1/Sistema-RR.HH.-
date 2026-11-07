const servicio = require("../services/casosQuejaService");

async function listarCatalogos(req, res) {
  res.json(await servicio.listarCatalogos());
}

async function listarResponsables(req, res) {
  res.json(await servicio.listarResponsables());
}

async function listarCasos(req, res) {
  res.json(await servicio.listarCasos(req.query));
}

async function obtenerCaso(req, res) {
  res.json(await servicio.obtenerCaso(req.params.idQueja));
}

async function clasificar(req, res) {
  res.json(await servicio.clasificar({ idQueja: req.params.idQueja, cuerpo: req.body ?? {} }));
}

async function registrarInvolucrado(req, res) {
  const involucrado = await servicio.registrarInvolucrado({
    idQueja: req.params.idQueja,
    cuerpo: req.body ?? {},
    idAdministrador: req.idEmpleado,
  });
  res.status(201).json(involucrado);
}

async function quitarInvolucrado(req, res) {
  await servicio.quitarInvolucrado({ idQueja: req.params.idQueja, idEmpleado: req.params.idEmpleado });
  res.status(204).end();
}

async function derivar(req, res) {
  const derivacion = await servicio.derivar({
    idQueja: req.params.idQueja,
    cuerpo: req.body ?? {},
    idAdministrador: req.idEmpleado,
  });
  res.status(201).json(derivacion);
}

async function reintentarAviso(req, res) {
  res.json(await servicio.reintentarAviso({ idQueja: req.params.idQueja, idAdministrador: req.idEmpleado }));
}

module.exports = {
  listarCatalogos,
  listarResponsables,
  listarCasos,
  obtenerCaso,
  clasificar,
  registrarInvolucrado,
  quitarInvolucrado,
  derivar,
  reintentarAviso,
};
