const servicio = require("../services/licenciasPlanilla.service");

async function listarAprobadas(req, res) {
  res.json(await servicio.listarAprobadas(req.query));
}

module.exports = { listarAprobadas };
