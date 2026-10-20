const servicio = require("../services/correosEntrevista.service");

async function enviarAvisoEntrevista(req, res) {
  res.json(await servicio.enviarAvisoEntrevista(req.body));
}

module.exports = { enviarAvisoEntrevista };
