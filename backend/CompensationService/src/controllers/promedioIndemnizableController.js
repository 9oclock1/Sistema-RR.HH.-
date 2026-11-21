const servicio = require("../services/promedioIndemnizableService");

const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

async function calcular(req, res) {
  res.json(await servicio.calcular(req.params.id, identidad(req)));
}

module.exports = { calcular };
