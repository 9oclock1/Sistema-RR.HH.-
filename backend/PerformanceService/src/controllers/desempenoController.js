const servicio = require("../services/desempenoService");

async function listarCiclos(req, res) {
  res.json(await servicio.listarCiclos());
}

async function obtenerConsolidado(req, res) {
  res.json(await servicio.obtenerConsolidado(req.params.idCiclo));
}

async function obtenerComparativa(req, res) {
  res.json(await servicio.obtenerComparativa(req.params.idCiclo, req.query));
}

async function obtenerColaboradores(req, res) {
  res.json(await servicio.obtenerColaboradores(req.params.idCiclo, req.query));
}

async function actualizarUmbral(req, res) {
  res.json(await servicio.actualizarUmbral(req.params.idCiclo, req.body));
}

module.exports = { listarCiclos, obtenerConsolidado, obtenerComparativa, obtenerColaboradores, actualizarUmbral };
