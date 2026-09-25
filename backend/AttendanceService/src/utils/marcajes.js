const { ErrorApp } = require("./errores");

const TIPO_MARCAJE = { ENTRADA: 1, SALIDA: 2 };
const ORIGEN_MARCAJE = { PORTAL: 1, BIOMETRICO: 2 };

function verificarEmpleadoActivo(empleado) {
  if (!empleado) {
    throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  }
  if (empleado.activo !== true) {
    throw new ErrorApp(403, "El empleado no está activo, por lo que no puede registrar marcajes.");
  }
  return empleado;
}

module.exports = { TIPO_MARCAJE, ORIGEN_MARCAJE, verificarEmpleadoActivo };
