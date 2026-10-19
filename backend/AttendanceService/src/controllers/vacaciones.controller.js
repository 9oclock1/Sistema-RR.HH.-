const servicio = require("../services/vacaciones.service");

async function miSaldo(req, res) {
  res.json(await servicio.consultarSaldo(req.idEmpleado));
}

async function saldoDeEmpleado(req, res) {
  res.json(await servicio.consultarSaldo(req.params.idEmpleado.toLowerCase()));
}

module.exports = { miSaldo, saldoDeEmpleado };
