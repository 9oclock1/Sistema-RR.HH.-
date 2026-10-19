const URL_ASISTENCIA = process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3004';
// Si Attendance no responde, el Kardex se entrega sin el historial; la espera no debe demorarlo.
const TIEMPO_ESPERA_MS = 1500;

const obtenerHistorial = async (idEmpleado, rol) => {
  const respuesta = await fetch(`${URL_ASISTENCIA}/empleados/${idEmpleado}/historial-asistencia`, {
    headers: { 'X-Rol': rol },
    signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
  });
  if (!respuesta.ok) throw new Error(`AttendanceService respondió ${respuesta.status}`);
  return respuesta.json();
};

module.exports = { obtenerHistorial };
