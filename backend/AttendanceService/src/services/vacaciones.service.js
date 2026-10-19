const modelo = require("../models/vacaciones.model");
const empleados = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { calcularSaldo, fechaBolivia } = require("../utils/vacaciones");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

async function obtenerEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  if (!empleado) throw new ErrorApp(404, "El empleado no está registrado.");
  if (!FECHA_RE.test(empleado.fecha_ingreso ?? "") || Number.isNaN(Date.parse(empleado.fecha_ingreso))) throw new ErrorApp(502, "No se pudo obtener la fecha de ingreso del empleado.");
  return empleado;
}

// Se calcula en cada consulta a partir de los movimientos vigentes: el saldo nunca queda desactualizado.
async function consultarSaldo(idEmpleado, ahora = new Date()) {
  const empleado = await obtenerEmpleado(idEmpleado);
  const hoy = fechaBolivia(ahora);
  const movimientos = await modelo.listarMovimientos(idEmpleado);
  return {
    id_empleado: idEmpleado,
    fecha_ingreso: empleado.fecha_ingreso,
    fecha_consulta: hoy,
    ...calcularSaldo(empleado.fecha_ingreso, hoy, movimientos),
    movimientos: movimientos.map(({ id_estado_movimiento, ...movimiento }) => movimiento),
  };
}

// Quien consulta su propio saldo y no es un empleado registrado se rechaza como identidad inválida (igual que licencias).
async function consultarMiSaldo(idEmpleado, ahora) {
  try {
    return await consultarSaldo(idEmpleado, ahora);
  } catch (error) {
    if (error.estado === 404) throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
    throw error;
  }
}

module.exports = { consultarSaldo, consultarMiSaldo };
