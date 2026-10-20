const servicio = require("../services/miAsistencia.service");

// RF-28: el colaborador solo ve su propio historial (no se acepta el id de otra persona).
async function consultar(req, res) {
  res.set("Cache-Control", "private, no-store");
  res.json(await servicio.consultar(req.idEmpleado, req.query));
}

module.exports = { consultar };
