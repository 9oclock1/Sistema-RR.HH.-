const servicio = require("../services/marcajes.service");

async function consultarJornada(req, res) {
  res.json(await servicio.consultarJornada(req.idEmpleado));
}

async function registrarEntrada(req, res) {
  res.status(201).json(await servicio.registrarEntrada(req.idEmpleado));
}

async function registrarSalida(req, res) {
  res.status(201).json(await servicio.registrarSalida(req.idEmpleado));
}

async function registrarEntradaBiometrica(req, res) {
  res.status(201).json(await servicio.registrarEntradaBiometrica(req.body, req.codigoDispositivo));
}

async function registrarSalidaBiometrica(req, res) {
  res.status(201).json(await servicio.registrarSalidaBiometrica(req.body, req.codigoDispositivo));
}

module.exports = {
  consultarJornada,
  registrarEntrada,
  registrarSalida,
  registrarEntradaBiometrica,
  registrarSalidaBiometrica,
};
