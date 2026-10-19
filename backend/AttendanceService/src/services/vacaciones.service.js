const modelo = require("../models/vacaciones.model");
const empleados = require("./empleados.service");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { calcularSaldo, fechaBolivia } = require("../utils/vacaciones");

async function obtenerEmpleado(idEmpleado) {
  const empleado = UUID_RE.test(idEmpleado) ? await empleados.obtener(idEmpleado) : null;
  if (!empleado) throw new ErrorApp(404, "El empleado no está registrado.");
  if (!empleado.fecha_ingreso) throw new ErrorApp(502, "No se pudo obtener la fecha de ingreso del empleado.");
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

module.exports = { consultarSaldo };
