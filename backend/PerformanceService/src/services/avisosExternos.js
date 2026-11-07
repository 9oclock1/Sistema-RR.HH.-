const URL_NOTIFICACIONES = process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3007";
const TIEMPO_ESPERA_MS = Number(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS) || 5000;

async function enviarAvisoDerivacion({ idRemitente, idResponsable, aviso }) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_NOTIFICACIONES}/comunicaciones/directa`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Empleado-Id": idRemitente, "X-Rol": "admin" },
      body: JSON.stringify({
        id_empleado_destinatario: idResponsable,
        asunto: aviso.asunto,
        contenido: aviso.contenido,
        prioridad: aviso.prioridad,
        remitente_nombre: "Recursos Humanos",
        notificar_correo: true,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch (error) {
    console.error("No se pudo avisar al responsable de la queja:", error.name);
    return { entregado: false };
  }
  if (!respuesta.ok) {
    console.error("NotificationService rechazó el aviso al responsable de la queja:", respuesta.status);
    return { entregado: false };
  }
  return { entregado: true };
}

module.exports = { enviarAvisoDerivacion };
