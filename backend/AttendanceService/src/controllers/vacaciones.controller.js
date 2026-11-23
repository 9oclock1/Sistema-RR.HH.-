const servicio = require("../services/vacaciones.service");

async function miSaldo(req, res) {
  res.json(await servicio.consultarMiSaldo(req.idEmpleado));
}

async function saldoDeEmpleado(req, res) {
  // ?fecha=AAAA-MM-DD: saldo al corte de esa fecha (liquidación de un retiro, KAN-77).
  res.json(await servicio.consultarSaldo(req.params.idEmpleado.toLowerCase(), new Date(), req.query.fecha));
}

module.exports = { miSaldo, saldoDeEmpleado };
