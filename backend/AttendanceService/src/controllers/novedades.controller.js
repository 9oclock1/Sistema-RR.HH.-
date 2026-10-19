const servicio = require("../services/novedades.service");

async function panel(req, res) {
  res.json(await servicio.panel(req.query));
}

module.exports = { panel };
