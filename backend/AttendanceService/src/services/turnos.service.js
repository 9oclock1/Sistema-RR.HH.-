const modelo = require("../models/turnos.model");
const { ErrorApp } = require("../utils/errores");
const { validarTurno } = require("../utils/validarTurno");
const { minutosDuracion, minutosEfectivos, evaluarPuntualidad } = require("../utils/jornada");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const FECHA_HORA_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

const noEncontrado = () => new ErrorApp(404, "Turno no encontrado");

const conCalculos = (turno) => ({
  ...turno,
  minutos_duracion: minutosDuracion(turno),
  minutos_efectivos: minutosEfectivos(turno),
});

function traducirErrorBD(error) {
  if (error.code === "23505") {
    throw new ErrorApp(409, "Ya existe un turno con ese nombre", [
      { campo: "nombre", mensaje: "Ya existe un turno con ese nombre." },
    ]);
  }
  if (error.code === "23503") {
    throw new ErrorApp(400, "El tipo de jornada no existe", [
      { campo: "id_tipo_jornada", mensaje: "Seleccione un tipo de jornada válido." },
    ]);
  }
  throw error;
}

async function buscar(id) {
  const turno = UUID_RE.test(id) ? await modelo.obtener(id) : undefined;
  if (!turno) throw noEncontrado();
  return turno;
}

async function listar(activo) {
  const turnos = await modelo.listar(activo);
  return turnos.map(conCalculos);
}

async function obtener(id) {
  return conCalculos(await buscar(id));
}

async function crear(datos) {
  const turno = validarTurno(datos);
  const creado = await modelo.crear(turno).catch(traducirErrorBD);
  return conCalculos(creado);
}

async function actualizar(id, datos) {
  const turno = validarTurno(datos);
  if (!UUID_RE.test(id)) throw noEncontrado();
  const editado = await modelo.actualizar(id, turno).catch(traducirErrorBD);
  if (!editado) throw noEncontrado();
  return conCalculos(editado);
}

async function eliminar(id) {
  if (!UUID_RE.test(id)) throw noEncontrado();
  let eliminados;
  try {
    eliminados = await modelo.eliminar(id);
  } catch (error) {
    if (error.code !== "23503") throw error;
    const total = await modelo.contarEmpleadosAsignados(id);
    throw new ErrorApp(409, `El turno se encuentra en uso: está asignado a ${total} empleado(s).`);
  }
  if (!eliminados) throw noEncontrado();
}

async function evaluarMarcaje(id, { fecha_jornada, fecha_hora_marcaje } = {}) {
  const errores = [];
  const fechaValida =
    FECHA_RE.test(fecha_jornada) && new Date(`${fecha_jornada}T00:00:00Z`).toISOString().startsWith(fecha_jornada);
  if (!fechaValida) errores.push({ campo: "fecha_jornada", mensaje: "Use el formato AAAA-MM-DD." });
  if (!FECHA_HORA_RE.test(fecha_hora_marcaje) || isNaN(Date.parse(fecha_hora_marcaje))) {
    errores.push({ campo: "fecha_hora_marcaje", mensaje: "Use fecha ISO con zona horaria." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Datos de marcaje inválidos", errores);

  const turno = await buscar(id);
  return evaluarPuntualidad(turno, fecha_jornada, new Date(fecha_hora_marcaje));
}

const listarTiposJornada = () => modelo.listarTiposJornada();

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  evaluarMarcaje,
  listarTiposJornada,
};
