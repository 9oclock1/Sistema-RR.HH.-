const URL_ASISTENCIA = process.env.ATTENDANCE_SERVICE_URL || 'http://attendance-service:3004';
const TIEMPO_ESPERA_MS = 3000;

const obtenerHistorial = async (idEmpleado, rol) => {
  const respuesta = await fetch(`${URL_ASISTENCIA}/empleados/${idEmpleado}/historial-asistencia`, {
    headers: { 'X-Rol': rol },
    signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
  });
  if (!respuesta.ok) throw new Error(`AttendanceService respondió ${respuesta.status}`);
  return respuesta.json();
};

module.exports = { obtenerHistorial };
