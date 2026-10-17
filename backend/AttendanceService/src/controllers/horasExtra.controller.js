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

module.exports = { listar, resumen, listarPeriodos, consolidar };
