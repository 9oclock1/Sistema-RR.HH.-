const { ErrorApp } = require("./errores");
const { horaBolivia } = require("./jornada");

const TIPO_MARCAJE = { ENTRADA: 1, SALIDA: 2 };
const ORIGEN_MARCAJE = { PORTAL: 1, BIOMETRICO: 2 };

const esEntrada = (marcaje) => marcaje.tipo_codigo === "ENTRADA";

function verificarEmpleadoActivo(empleado) {
  if (!empleado) {
    throw new ErrorApp(403, "El usuario no corresponde a un empleado registrado.");
  }
  if (empleado.activo !== true) {
    throw new ErrorApp(403, "El empleado no está activo, por lo que no puede registrar marcajes.");
  }
  return empleado;
}

function entradaDuplicada(marcaje) {
  const hora = marcaje ? ` a las ${horaBolivia(marcaje.fecha_hora_marcaje)}` : "";
  return new ErrorApp(409, `Ya registró su entrada de hoy${hora}.`);
}

module.exports = { TIPO_MARCAJE, ORIGEN_MARCAJE, esEntrada, verificarEmpleadoActivo, entradaDuplicada };
