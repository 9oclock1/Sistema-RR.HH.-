const servicio = require("../services/historialAsistencia.service");

async function historial(req, res) {
  res.json(await servicio.historial(req.params.idEmpleado, req.query));
}

module.exports = { historial };
