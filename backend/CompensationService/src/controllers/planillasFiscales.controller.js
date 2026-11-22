const tributaria = require("../services/planillasTributarias.service");
const aportes = require("../services/planillasAportes.service");

const identidad = (req) => ({
  idEmpleado: req.get("X-Empleado-Id")?.trim() || null,
  rol: req.get("X-Rol")?.trim() || null,
});

function enviarArchivo(res, { nombreArchivo, tipo, contenido }) {
  res.set({
    "Content-Type": tipo,
    "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
    "Content-Length": String(contenido.length),
    "Cache-Control": "no-store",
  });
  res.send(contenido);
}

async function generarTributaria(req, res) {
  res.status(201).json(await tributaria.generar(req.params.id, identidad(req)));
}

async function obtenerTributaria(req, res) {
  res.json(await tributaria.obtener(req.params.id, identidad(req)));
}

async function exportarTributaria(req, res) {
  enviarArchivo(res, await tributaria.exportar(req.params.id, identidad(req), req.query.formato));
}

async function generarAportes(req, res) {
  res.status(201).json(await aportes.generar(req.params.id, identidad(req)));
}

async function obtenerAportes(req, res) {
  res.json(await aportes.obtener(req.params.id, identidad(req)));
}

async function exportarAportes(req, res) {
  enviarArchivo(res, await aportes.exportar(req.params.id, identidad(req), req.query));
}

async function listarParametros(req, res) {
  res.json(await tributaria.listarParametros(identidad(req)));
}

async function listarCreditos(req, res) {
  res.json(await tributaria.listarCreditos(req.query.periodo, identidad(req)));
}

async function registrarCredito(req, res) {
  res.json(await tributaria.registrarCredito(req.body, identidad(req)));
}

module.exports = {
  generarTributaria,
  obtenerTributaria,
  exportarTributaria,
  generarAportes,
  obtenerAportes,
  exportarAportes,
  listarParametros,
  listarCreditos,
  registrarCredito,
};
