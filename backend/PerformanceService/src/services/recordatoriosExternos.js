const URL_NOTIFICACIONES =
  process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3007";
const TIEMPO_ESPERA_MS =
  Number(process.env.NOTIFICATION_SERVICE_TIMEOUT_MS) || 5000;
const RUTA_EVALUACIONES = "/desempeno/evaluaciones";

async function enviarRecordatorioEvaluaciones({
  idRemitente,
  idEvaluador,
  aviso,
}) {
  let respuesta;
  try {
    respuesta = await fetch(`${URL_NOTIFICACIONES}/comunicaciones/directa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Empleado-Id": idRemitente,
        "X-Rol": "admin",
      },
      body: JSON.stringify({
        id_empleado_destinatario: idEvaluador,
        asunto: aviso.asunto,
        contenido: aviso.contenido,
        prioridad: "ALTA",
        enlace: RUTA_EVALUACIONES,
        remitente_nombre: "Recursos Humanos",
        notificar_correo: true,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
  } catch (error) {
    console.error(
      `[ciclos] No se pudo avisar al evaluador ${idEvaluador}:`,
      error.name,
    );
    return { entregado: false };
  }
  if (!respuesta.ok) {
    console.error(
      `[ciclos] NotificationService rechazó el aviso al evaluador ${idEvaluador}:`,
      respuesta.status,
    );
    return { entregado: false };
  }
  return { entregado: true };
}

module.exports = { enviarRecordatorioEvaluaciones };
