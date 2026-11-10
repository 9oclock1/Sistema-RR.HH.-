const { ErrorApp } = require("../utils/errores");

// Los colaboradores y la jerarquía de cargos viven en EmployeeService; PerformanceDB solo guarda una réplica mínima.
const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = Number(process.env.EMPLOYEE_SERVICE_LISTA_TIMEOUT_MS) || 8000;

const sinConexion = () =>
  new ErrorApp(503, "No se pudo consultar al personal y la jerarquía. Intente nuevamente en unos minutos.");

async function pedirLista(ruta) {
  let lista;
  try {
    const respuesta = await fetch(`${URL_EMPLEADOS}${ruta}`, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
    if (!respuesta.ok) throw new Error(`EmployeeService respondió ${respuesta.status}`);
    lista = await respuesta.json();
  } catch (error) {
    console.error(`No se pudo consultar ${ruta} en EmployeeService:`, error.name, error.message);
    throw sinConexion();
  }
  if (!Array.isArray(lista)) {
    console.error(`EmployeeService no devolvió una lista en ${ruta}`);
    throw sinConexion();
  }
  return lista;
}

// { id_empleado, nombre_completo, cargo, area, sucursal, id_cargo, id_departamento, id_sucursal, activo }
const listarColaboradores = () => pedirLista("/empleados");

// { id_cargo, nombre, id_cargo_superior, superior_nombre, ... } de los cargos activos.
const listarCargos = () => pedirLista("/jerarquia/cargos");

module.exports = { listarColaboradores, listarCargos };
