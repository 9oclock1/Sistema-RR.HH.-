const servicio = require("../services/ciclosService");
const proceso = require("../services/procesoCiclosService");
const { ErrorApp } = require("../utils/errores");

async function opciones(req, res) {
  res.json(await servicio.opciones());
}

async function vistaPrevia(req, res) {
  res.json(await servicio.vistaPrevia(req.body));
}

async function crear(req, res) {
  res.status(201).json(await servicio.crear(req.idEmpleado, req.body));
}

async function listar(req, res) {
  res.json(await servicio.listar());
}

async function obtener(req, res) {
  res.json(await servicio.obtener(req.params.idCiclo));
}

// Ejecuta ahora lo mismo que el job diario: activar, recordar y cerrar. Sirve para probar sin esperar a las 8:00.
async function procesar(req, res) {
  const resultado = await proceso.procesar();
  if (!resultado) throw new ErrorApp(409, "Ya hay un proceso de ciclos en ejecución. Intente en unos segundos.");
  res.json(resultado);
}

module.exports = { opciones, vistaPrevia, crear, listar, procesar, obtener };
