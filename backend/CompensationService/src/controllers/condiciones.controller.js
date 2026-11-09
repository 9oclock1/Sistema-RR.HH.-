const servicio = require("../services/condiciones.service");

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

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.body));
}

async function actualizar(req, res) {
  res.json(await servicio.actualizar(req.params.id, req.body));
}

async function eliminar(req, res) {
  await servicio.eliminar(req.params.id);
  res.status(204).end();
}

async function listarBonos(req, res) {
  res.json(await servicio.listarBonos(req.query));
}

async function procesar(req, res) {
  res.json(await servicio.procesar(req.body, identidad(req)));
}

async function listarAsignaciones(req, res) {
  res.json(await servicio.listarAsignaciones(req.params.id));
}

async function asignar(req, res) {
  res.status(201).json(await servicio.asignar(req.params.id, req.body));
}

async function cambiarFinAsignacion(req, res) {
  res.json(await servicio.cambiarFinAsignacion(req.params.id, req.params.idAsignacion, req.body));
}

async function eliminarAsignacion(req, res) {
  await servicio.eliminarAsignacion(req.params.id, req.params.idAsignacion);
  res.status(204).end();
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  listarBonos,
  procesar,
  listarAsignaciones,
  asignar,
  cambiarFinAsignacion,
  eliminarAsignacion,
};
