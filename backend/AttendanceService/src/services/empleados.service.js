const { ErrorApp } = require("../utils/errores");
const simulados = require("../config/empleadosSimulados");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = 3000;

const sinConexion = () => new ErrorApp(503, "No se pudo verificar al empleado. Intente nuevamente.");

async function obtener(idEmpleado) {
  if (process.env.EMPLEADOS_SIMULADOS === "true") {
    return simulados.find((empleado) => empleado.id_empleado === idEmpleado) ?? null;
  }

  let respuesta;
  try {
    respuesta = await fetch(`${URL_EMPLEADOS}/empleados/${idEmpleado}`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch {
    throw sinConexion();
  }
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw sinConexion();
  return respuesta.json().catch(() => {
    throw sinConexion();
  });
}

module.exports = { obtener };
