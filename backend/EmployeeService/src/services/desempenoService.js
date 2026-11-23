const URL_DESEMPENO = process.env.PERFORMANCE_SERVICE_URL || 'http://performance-service:3006';
const TIEMPO_ESPERA_MS = Number(process.env.PERFORMANCE_SERVICE_TIMEOUT_MS) || 5000;

// KAN-81: nota de la última evaluación de desempeño del empleado, tomada del historial consolidado de PerformanceService
// (solo ciclos cerrados, del más reciente al más antiguo). Se consulta en nombre del propio empleado: PerformanceService
// le permite ver su historial sin rol de RRHH. Devuelve null si nunca tuvo un ciclo de evaluación cerrado.
// Lanza un error si PerformanceService no responde, para que la postulación quede pendiente de validar.
const obtenerUltimaEvaluacion = async (idEmpleado) => {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_DESEMPENO}/evaluaciones/historial/${encodeURIComponent(idEmpleado)}`, {
      headers: { 'X-Empleado-Id': idEmpleado, 'X-Rol': 'empleado' },
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch (error) {
    throw new Error(`No se pudo contactar a PerformanceService: ${error.message}`);
  }
  if (respuesta.status === 404) return null;
  if (!respuesta.ok) throw new Error(`PerformanceService respondió ${respuesta.status}`);

  const historial = await respuesta.json();
  const ultimo = (historial?.ciclos ?? []).find((ciclo) => ciclo.puntaje_final !== null && ciclo.puntaje_final !== undefined);
  if (!ultimo) return null;
  return { nota: Number(ultimo.puntaje_final), ciclo: ultimo.nombre, id_ciclo: ultimo.id_ciclo, cerrado_en: ultimo.cerrado_en };
};

module.exports = { obtenerUltimaEvaluacion };
