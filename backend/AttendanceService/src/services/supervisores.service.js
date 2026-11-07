const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = 3000;

// Supervisor directo del colaborador: { id_empleado, nombres, apellidos } o null.
// Es un dato de apoyo para avisar la solicitud: si no se puede consultar, la solicitud igual se registra sin él.
// Con EMPLEADOS_SIMULADOS=true no hay EmployeeService, así que tampoco hay supervisor.
async function obtenerSupervisor(idEmpleado) {
  if (process.env.EMPLEADOS_SIMULADOS === "true") return null;
  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}/empleados/${idEmpleado}/supervisor`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (!respuesta.ok) return null;
    return (await respuesta.json()).supervisor ?? null;
  } catch {
    return null;
  }
}

module.exports = { obtenerSupervisor };
