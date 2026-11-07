const servicio = require("../services/planillas.service");

// Temporal: el portal envía quién actúa (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id));
}

// 201 si la planilla del mes es nueva; 200 si se volvió a generar el borrador.
async function generar(req, res) {
  const { creada, planilla } = await servicio.generar(req.body, identidad(req));
  res.status(creada ? 201 : 200).json(planilla);
}

async function descartar(req, res) {
  await servicio.descartar(req.params.id, identidad(req));
  res.status(204).end();
}

module.exports = { listar, obtener, generar, descartar };
