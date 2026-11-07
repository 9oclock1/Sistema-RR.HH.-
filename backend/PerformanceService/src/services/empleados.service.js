const { ErrorApp } = require("../utils/errores");

// Consulta a EmployeeService los datos que PerformanceDB replica en EMPLEADOS y DEPARTAMENTOS.
const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = 3000;

const sinConexion = () =>
  new ErrorApp(503, "No se pudieron consultar los datos del personal. Intente nuevamente.");

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

// { id_empleado, nombres, apellidos } o null si no existe.
async function obtenerEmpleado(idEmpleado) {
  const empleado = await consultar(`/empleados/${idEmpleado}`);
  if (!empleado) return null;
  return { id_empleado: empleado.id_empleado, nombres: empleado.nombres, apellidos: empleado.apellidos };
}

// { id_departamento, nombre } del área activa, o null si no existe o fue dada de baja.
async function obtenerDepartamento(idDepartamento) {
  const departamentos = await consultar("/departamentos");
  if (!Array.isArray(departamentos)) throw sinConexion();
  const departamento = departamentos.find((d) => d.id_departamento === idDepartamento);
  return departamento ? { id_departamento: departamento.id_departamento, nombre: departamento.nombre } : null;
}

module.exports = { obtenerEmpleado, obtenerDepartamento };
