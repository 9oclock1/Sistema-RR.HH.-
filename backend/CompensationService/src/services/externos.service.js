const { ErrorApp } = require("../utils/errores");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const URL_ASISTENCIA = process.env.ATTENDANCE_SERVICE_URL || "http://attendance-service:3004";
const TIEMPO_ESPERA_MS = 10000;

async function consultar(url, mensaje) {
  const error = () => new ErrorApp(503, mensaje);
  let respuesta;
  try {
    respuesta = await fetch(url, { signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  } catch {
    throw error();
  }
  if (!respuesta.ok) throw error();
  return respuesta.json().catch(() => {
    throw error();
  });
}

// Todo el personal de EmployeeService: [{ id_empleado, nombre_completo, area, ... }].
async function listarPersonal() {
  const lista = await consultar(
    `${URL_EMPLEADOS}/empleados`,
    "No se pudieron obtener los datos del personal. Intente nuevamente."
  );
  if (!Array.isArray(lista)) throw new ErrorApp(503, "No se pudieron obtener los datos del personal.");
  return lista;
}

// Jornadas marcadas de todo el personal en el rango, con minutos nocturnos y feriado (AttendanceService).
async function listarJornadas(desde, hasta) {
  const parametros = new URLSearchParams({ desde, hasta });
  const datos = await consultar(
    `${URL_ASISTENCIA}/horas-extra/jornadas?${parametros}`,
    "No se pudieron obtener las jornadas de Asistencia. Intente nuevamente."
  );
  if (!Array.isArray(datos?.jornadas)) throw new ErrorApp(503, "No se pudieron obtener las jornadas de Asistencia.");
  return datos.jornadas;
}

module.exports = { listarPersonal, listarJornadas };
