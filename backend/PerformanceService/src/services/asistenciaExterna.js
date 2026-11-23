const { ErrorApp } = require("../utils/errores");

const URL_ASISTENCIA = process.env.ATTENDANCE_SERVICE_URL || "http://attendance-service:3004";
const TIEMPO_ESPERA_MS = Number(process.env.ATTENDANCE_SERVICE_TIMEOUT_MS) || 5000;

// KPI-06 (RF-73, KAN-506) se calcula sobre el mismo reporte de asistencia de RF-29 (GET /reportes/asistencia):
// ese endpoint ya resuelve el alcance por rol (RRHH ve toda la empresa; el supervisor, solo su sucursal) y
// trae, por empleado, sus minutos de atraso, su sucursal y su área. Reenviar la misma identidad (X-Empleado-Id/
// X-Rol) evita que este dashboard tenga que volver a averiguar a quién supervisa cada supervisor.
async function obtenerReporteAsistencia({ desde, hasta, idSucursal, idDepartamento }, { idEmpleado, rol }) {
  const parametros = new URLSearchParams({ desde, hasta });
  if (idSucursal) parametros.set("id_sucursal", idSucursal);
  if (idDepartamento) parametros.set("id_departamento", idDepartamento);
  const cabeceras = { "X-Rol": rol ?? "" };
  if (idEmpleado) cabeceras["X-Empleado-Id"] = idEmpleado;

  let respuesta;
  try {
    respuesta = await fetch(`${URL_ASISTENCIA}/reportes/asistencia?${parametros}`, {
      headers: cabeceras,
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch {
    throw new ErrorApp(503, "No se pudo consultar los atrasos en Asistencia. Intente nuevamente.");
  }
  const cuerpo = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    // Se propaga el mismo estado (401/403/400) que da Asistencia: así, por ejemplo, el rechazo al supervisor
    // que no existe o que pide otra sucursal se ve igual aquí que en su propio reporte.
    throw new ErrorApp(respuesta.status, cuerpo?.error || "No se pudo consultar los atrasos en Asistencia.", cuerpo?.detalles);
  }
  if (!cuerpo) throw new ErrorApp(503, "Asistencia respondió con un formato inesperado. Intente nuevamente.");
  return cuerpo;
}

module.exports = { obtenerReporteAsistencia };
