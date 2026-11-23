const servicio = require("../services/saldosProporcionalesService");

const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

async function calcular(req, res) {
  res.json(await servicio.calcular(req.params.id, identidad(req)));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id, identidad(req)));
}

module.exports = { calcular, obtener };
