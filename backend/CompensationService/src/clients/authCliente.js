const { ErrorApp } = require("../utils/errores");

const URL_AUTH = () => process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
const TIEMPO_ESPERA_MS = 5000;
const claveInterna = () => process.env.CLAVE_SERVICIOS_INTERNOS || "";

async function revocarAcceso(idEmpleado, { idProceso, solicitadoPor }) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_AUTH()}/usuarios/${encodeURIComponent(idEmpleado)}/revocar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Clave-Servicio": claveInterna(),
      },
      body: JSON.stringify({
        id_proceso: idProceso,
        solicitado_por: solicitadoPor,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch {
    throw new ErrorApp(503, "No se pudo revocar el acceso en AuthService. Intente nuevamente.");
  }
  if (!respuesta.ok) {
    throw new ErrorApp(503, "No se pudo revocar el acceso en AuthService. Intente nuevamente.");
  }
  return respuesta.json().catch(() => {
    throw new ErrorApp(503, "No se pudo revocar el acceso en AuthService. Intente nuevamente.");
  });
}

async function consultarAcceso(idEmpleado) {
  try {
    const respuesta = await fetch(`${URL_AUTH()}/usuarios/${encodeURIComponent(idEmpleado)}/acceso`, {
      headers: {
        Accept: "application/json",
        "X-Clave-Servicio": claveInterna(),
      },
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (!respuesta.ok) return null;
    return await respuesta.json();
  } catch {
    return null;
  }
}

module.exports = { revocarAcceso, consultarAcceso };
