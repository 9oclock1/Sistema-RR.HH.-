const servicio = require("../services/aguinaldo.service");

// Temporal: el portal envía quién actúa (X-Empleado-Id) y su rol (X-Rol) hasta contar con autenticación.
const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

async function listar(req, res) {
  res.json(await servicio.listar());
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.id));
}

async function generar(req, res) {
  const { creado, aguinaldo } = await servicio.generar(req.body, identidad(req));
  res.status(creado ? 201 : 200).json(aguinaldo);
}

async function descartar(req, res) {
  await servicio.descartar(req.params.id, identidad(req));
  res.status(204).end();
}

async function aprobar(req, res) {
  res.json(await servicio.aprobar(req.params.id, identidad(req)));
}

async function reenviar(req, res) {
  res.json(await servicio.reenviar(req.params.id, req.params.destino, identidad(req)));
}

async function simularConfirmacion(req, res) {
  res.json(await servicio.simularConfirmacion(req.params.id, req.params.destino, req.body, identidad(req)));
}

module.exports = { listar, obtener, generar, descartar, aprobar, reenviar, simularConfirmacion };
