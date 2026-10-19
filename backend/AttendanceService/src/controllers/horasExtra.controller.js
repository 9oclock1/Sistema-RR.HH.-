const servicio = require("../services/horasExtra.service");

async function listar(req, res) {
  res.json(await servicio.listar(req.query));
}

// Con ?formato=csv se descarga para planillas.
async function resumen(req, res) {
  const datos = await servicio.resumen(req.query);
  if (req.query.formato !== "csv") return res.json(datos);
  const { nombre, contenido } = servicio.aCsv(datos);
  res.set({
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${nombre}"`,
    "Cache-Control": "private, no-store",
  });
  res.send(contenido);
}

async function listarPeriodos(req, res) {
  res.json(await servicio.listarPeriodos());
}

async function consolidar(req, res) {
  res.status(201).json(await servicio.consolidar(req.idEmpleado, req.body));
}

async function revisar(req, res) {
  res.json(await servicio.revisar(req.params.idHorasJornada, req.idEmpleado, req.body));
}

async function listarAutorizaciones(req, res) {
  res.json(await servicio.listarAutorizaciones(req.query));
}

// 201 si es nueva; 200 si reemplaza la del mismo día.
async function autorizar(req, res) {
  const { creada, ...autorizacion } = await servicio.autorizar(req.idEmpleado, req.body);
  res.status(creada ? 201 : 200).json(autorizacion);
}

async function eliminarAutorizacion(req, res) {
  await servicio.eliminarAutorizacion(req.params.idAutorizacion, req.idEmpleado);
  res.status(204).end();
}

module.exports = {
  listar,
  resumen,
  listarPeriodos,
  consolidar,
  revisar,
  listarAutorizaciones,
  autorizar,
  eliminarAutorizacion,
};
