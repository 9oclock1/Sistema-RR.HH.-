const { ErrorApp } = require("../utils/errores");

const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const URL_ASISTENCIA = process.env.ATTENDANCE_SERVICE_URL || "http://attendance-service:3004";
const TIEMPO_ESPERA_MS = 10000;
// Las consultas de planillas ven a todo el personal, como RRHH.
const COMO_RRHH = { "X-Rol": "admin" };

async function consultar(url, mensaje, cabeceras = {}) {
  const error = () => new ErrorApp(503, mensaje);
  let respuesta;
  try {
    respuesta = await fetch(url, { headers: cabeceras, signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  } catch {
    throw error();
  }
  if (!respuesta.ok) throw error();
  return respuesta.json().catch(() => {
    throw error();
  });
}

const rango = (desde, hasta) => new URLSearchParams({ desde, hasta });

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
  const datos = await consultar(
    `${URL_ASISTENCIA}/horas-extra/jornadas?${rango(desde, hasta)}`,
    "No se pudieron obtener las jornadas de Asistencia. Intente nuevamente."
  );
  if (!Array.isArray(datos?.jornadas)) throw new ErrorApp(503, "No se pudieron obtener las jornadas de Asistencia.");
  return datos.jornadas;
}

// Versiones de contrato que rigen en el rango, con su haber mensual (EmployeeService).
async function listarContratos(desde, hasta) {
  const lista = await consultar(
    `${URL_EMPLEADOS}/contratos/vigentes?${rango(desde, hasta)}`,
    "No se pudieron obtener los contratos del personal. Intente nuevamente.",
    COMO_RRHH
  );
  if (!Array.isArray(lista)) throw new ErrorApp(503, "No se pudieron obtener los contratos del personal.");
  return lista;
}

// Periodos de horas extra consolidados en Asistencia.
async function listarPeriodosHorasExtra() {
  const lista = await consultar(
    `${URL_ASISTENCIA}/horas-extra/periodos`,
    "No se pudieron obtener los periodos de horas extra de Asistencia. Intente nuevamente."
  );
  if (!Array.isArray(lista)) throw new ErrorApp(503, "No se pudieron obtener los periodos de horas extra.");
  return lista;
}

// Horas extra, domingos, feriados, descansos y nocturnas aprobadas por colaborador.
async function resumirHorasExtra(desde, hasta) {
  const datos = await consultar(
    `${URL_ASISTENCIA}/horas-extra/resumen?${rango(desde, hasta)}`,
    "No se pudieron obtener las horas extra de Asistencia. Intente nuevamente."
  );
  if (!Array.isArray(datos?.empleados)) throw new ErrorApp(503, "No se pudieron obtener las horas extra de Asistencia.");
  return datos.empleados;
}

// Faltas y atrasos sin justificar por colaborador (reporte de asistencia de toda la empresa).
async function resumirAsistencia(desde, hasta) {
  const datos = await consultar(
    `${URL_ASISTENCIA}/reportes/asistencia?${rango(desde, hasta)}`,
    "No se pudieron obtener las faltas y atrasos de Asistencia. Intente nuevamente.",
    COMO_RRHH
  );
  if (!Array.isArray(datos?.empleados)) throw new ErrorApp(503, "No se pudieron obtener las faltas y atrasos de Asistencia.");
  return datos.empleados;
}

// Licencias aprobadas del personal, con o sin goce de haberes.
async function listarLicencias(desde, hasta) {
  const datos = await consultar(
    `${URL_ASISTENCIA}/licencias/aprobadas?${rango(desde, hasta)}`,
    "No se pudieron obtener las licencias de Asistencia. Intente nuevamente."
  );
  if (!Array.isArray(datos?.licencias)) throw new ErrorApp(503, "No se pudieron obtener las licencias de Asistencia.");
  return datos.licencias;
}

// Saldo de vacaciones de un colaborador al corte de `fecha` (módulo de vacaciones de AttendanceService, KAN-77):
// { fecha_ingreso, anios_servicio, saldo: { acumulados, gozados, en_proceso, disponibles }, periodos, proximo_periodo }.
async function saldoVacaciones(idEmpleado, fecha) {
  const url = `${URL_ASISTENCIA}/vacaciones/empleados/${encodeURIComponent(idEmpleado)}/saldo?${new URLSearchParams({ fecha })}`;
  let respuesta;
  try {
    respuesta = await fetch(url, { headers: COMO_RRHH, signal: AbortSignal.timeout(TIEMPO_ESPERA_MS) });
  } catch {
    throw new ErrorApp(503, "No se pudo consultar el saldo de vacaciones: el módulo de vacaciones no responde. Intente nuevamente.");
  }
  if (respuesta.status === 404) {
    throw new ErrorApp(409, "El colaborador no está registrado en el módulo de vacaciones: no se puede calcular su saldo.");
  }
  if (!respuesta.ok) throw new ErrorApp(503, "No se pudo consultar el saldo de vacaciones. Intente nuevamente.");
  return respuesta.json().catch(() => {
    throw new ErrorApp(503, "No se pudo consultar el saldo de vacaciones. Intente nuevamente.");
  });
}

module.exports = {
  saldoVacaciones,
  listarPersonal,
  listarJornadas,
  listarContratos,
  listarPeriodosHorasExtra,
  resumirHorasExtra,
  resumirAsistencia,
  listarLicencias,
};
