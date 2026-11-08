const servicio = require("../services/confirmaciones.service");

// Temporal: el portal envía quién actúa (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

async function listar(req, res) {
  res.json(await servicio.listar(req.query, identidad(req)));
}

async function reprocesar(req, res) {
  res.json(await servicio.reprocesar(req.params.id, identidad(req)));
}

module.exports = { listar, reprocesar };
