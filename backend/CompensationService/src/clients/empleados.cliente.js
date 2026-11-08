const { ErrorApp } = require("../utils/errores");
const { hoyLaPaz } = require("../utils/fechas");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = Number(process.env.EMPLOYEE_SERVICE_TIMEOUT_MS) || 5000;

const sinConexion = () =>
  new ErrorApp(503, "No se pudo verificar al colaborador: EmployeeService no responde. Intente nuevamente.");
const sinContratos = () =>
  new ErrorApp(503, "No se pudo consultar el contrato del colaborador: EmployeeService no responde. Intente nuevamente.");
const sinPersonal = () =>
  new ErrorApp(503, "No se pudo obtener la lista de colaboradores: EmployeeService no responde. Intente nuevamente.");

async function consultar(ruta, cabeceras, error) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_EMPLEADOS}${ruta}`, {
      headers: { Accept: "application/json", ...cabeceras },
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch {
    throw error();
  }
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw error();
  return respuesta.json().catch(() => {
    throw error();
  });
}

// { id_empleado, nombres, apellidos, fecha_ingreso, activo } o null si no existe.
async function obtenerEmpleado(idEmpleado) {
  return consultar(`/empleados/${encodeURIComponent(idEmpleado)}`, {}, sinConexion);
}

// Todos los colaboradores: [{ id_empleado, nombre_completo, activo, ... }].
async function listarEmpleados() {
  const lista = await consultar("/empleados", {}, sinPersonal);
  return Array.isArray(lista) ? lista : [];
}

// Haber mensual pactado en el contrato vigente a `fecha` (por defecto, hoy). No usamos el campo
// es_version_vigente del historial porque ese siempre se calcula contra CURRENT_DATE: si lo usáramos para
// recalcular un periodo pasado, un cambio de sueldo posterior "contaminaría" el bono ya calculado de meses
// anteriores. En su lugar buscamos la versión cuyo rango [fecha_vigencia, vigente_hasta] cubre `fecha`,
// así el monto siempre se deriva de la fórmula (sueldo vigente EN ESE PERIODO * porcentaje), nunca de un
// monto fijo guardado.
// Llamada interna de servidor a servidor: X-Rol es el mecanismo temporal de autorización de este sistema
// (ver EmployeeService/src/middlewares/exigirRol.js), aquí usado para leer el contrato, no para suplantar a nadie.
async function obtenerHaberVigente(idEmpleado, fecha = hoyLaPaz()) {
  const historial = await consultar(
    `/contratos?id_empleado=${encodeURIComponent(idEmpleado)}`,
    { "X-Rol": "admin" },
    sinContratos
  );
  if (!Array.isArray(historial)) return null;
  const vigente = historial.find(
    (version) => version.fecha_vigencia <= fecha && (!version.vigente_hasta || version.vigente_hasta >= fecha)
  );
  return vigente ? Number(vigente.haber_mensual_pactado) : null;
}

module.exports = { obtenerEmpleado, listarEmpleados, obtenerHaberVigente };
