const URL_EMPLEADOS = process.env.EMPLOYEE_SERVICE_URL || "http://employee-service:3002";
const TIEMPO_ESPERA_MS = Number(process.env.EMPLOYEE_SERVICE_TIMEOUT_MS) || 3000;

const SIN_RESPUESTA = { estado: "sin_respuesta", nombres: null, apellidos: null };

async function consultarEmpleado(idEmpleado) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_EMPLEADOS}/empleados/${idEmpleado}`, {
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch {
    return SIN_RESPUESTA;
  }
  if (respuesta.status === 404) return { estado: "no_existe", nombres: null, apellidos: null };
  if (!respuesta.ok) return SIN_RESPUESTA;
  const datos = await respuesta.json().catch(() => null);
  if (!datos) return SIN_RESPUESTA;
  return { estado: "encontrado", nombres: datos.nombres || null, apellidos: datos.apellidos || null };
}

module.exports = { consultarEmpleado };
