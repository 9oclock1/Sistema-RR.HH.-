const URL_NOTIFICACIONES = () => process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3007";
const TIEMPO_ESPERA_MS = 5000;

// Remitente de los avisos automáticos del sistema (mismo UUID que EmployeeService).
const USUARIO_SISTEMA = "00000000-0000-4000-8000-000000000001";
const REMITENTE_NOMBRE = "Sistema de RRHH (finiquitos)";

async function enviarAvisoPrioritario({
  idRemitente = USUARIO_SISTEMA,
  remitenteNombre = REMITENTE_NOMBRE,
  idDestinatario,
  asunto,
  contenido,
  enlace,
}) {
  try {
    const respuesta = await fetch(`${URL_NOTIFICACIONES()}/comunicaciones/directa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Empleado-Id": idRemitente,
        "X-Rol": "admin",
      },
      body: JSON.stringify({
        id_empleado_destinatario: idDestinatario,
        remitente_nombre: remitenteNombre,
        asunto,
        contenido,
        prioridad: "ALTA",
        notificar_correo: true,
        enlace,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => null);
      console.error(`[finiquito] NotificationService rechazó el aviso (${respuesta.status}): ${cuerpo?.error || "sin detalle"}`);
    }
    return respuesta.ok;
  } catch (error) {
    console.error("[finiquito] No se pudo contactar a NotificationService:", error.message);
    return false;
  }
}

module.exports = { enviarAvisoPrioritario, USUARIO_SISTEMA, REMITENTE_NOMBRE };
