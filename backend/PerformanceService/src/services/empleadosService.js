const { ErrorApp } = require("../utils/errores");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://nginx-gateway/api/empl";
const TIEMPO_ESPERA_MS = 3000;

const sinConexion = () =>
  new ErrorApp(503, "No se pudo consultar el servicio de empleados. Intente nuevamente.");

async function consultar(ruta) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_EMPLEADOS}${ruta}`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  } catch {
    throw sinConexion();
  }
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw sinConexion();
  return respuesta.json().catch(() => {
    throw sinConexion();
  });
}

// Área activa de EmployeeService: { id_departamento, nombre }, o null si no existe o está dada de baja.
async function obtenerDepartamento(idDepartamento) {
  const departamentos = await consultar("/departamentos");
  const departamento = Array.isArray(departamentos)
    ? departamentos.find((area) => area.id_departamento === idDepartamento)
    : null;
  return departamento ? { id_departamento: departamento.id_departamento, nombre: departamento.nombre } : null;
}

// Empleado de EmployeeService: { id_empleado, nombres, apellidos }, o null si no existe.
async function obtenerEmpleado(idEmpleado) {
  const empleado = await consultar(`/empleados/${idEmpleado}`);
  return empleado
    ? { id_empleado: empleado.id_empleado, nombres: empleado.nombres, apellidos: empleado.apellidos }
    : null;
}

module.exports = { obtenerDepartamento, obtenerEmpleado };
