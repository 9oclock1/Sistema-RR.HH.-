const servicio = require("../services/seguimientoQuejaService");

async function listarCatalogos(req, res) {
  res.json(await servicio.listarCatalogos());
}

async function listarAsignados(req, res) {
  res.json(await servicio.listarAsignados(req.query, req.idEmpleado));
}

async function obtenerAsignado(req, res) {
  res.json(await servicio.obtenerAsignado(req.params.idQueja, req.idEmpleado));
}

async function obtenerSeguimiento(req, res) {
  res.json(
    await servicio.obtenerSeguimiento(req.params.idQueja, {
      esAdministrador: req.rol === "admin",
      idEmpleado: req.idEmpleado ?? null,
    }),
  );
}

async function registrarAccion(req, res) {
  const accion = await servicio.registrarAccion({
    idQueja: req.params.idQueja,
    cuerpo: req.body ?? {},
    idEmpleado: req.idEmpleado,
  });
  res.status(201).json(accion);
}

async function cambiarEstado(req, res) {
  res.json(await servicio.cambiarEstado({ idQueja: req.params.idQueja, cuerpo: req.body ?? {}, idEmpleado: req.idEmpleado }));
}

async function reintentarAvisoResolucion(req, res) {
  res.json(await servicio.reintentarAvisoResolucion({ idQueja: req.params.idQueja, idEmpleado: req.idEmpleado }));
}

module.exports = {
  listarCatalogos,
  listarAsignados,
  obtenerAsignado,
  obtenerSeguimiento,
  registrarAccion,
  cambiarEstado,
  reintentarAvisoResolucion,
};
