const URL_NOTIFICACIONES = process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3007";
const TIEMPO_ESPERA_MS = 3000;

const formatearFecha = (texto) => texto.split("-").reverse().join("/");

// Deja el aviso en la bandeja del supervisor como mensaje directo del colaborador.
// Devuelve false si NotificationService no lo aceptó; la solicitud ya quedó guardada.
async function avisarSolicitudVacaciones({ empleado, supervisor, solicitud }) {
  const nombre = `${empleado.nombres} ${empleado.apellidos}`;
  try {
    const respuesta = await fetch(`${URL_NOTIFICACIONES}/comunicaciones/directa`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Empleado-Id": empleado.id_empleado,
        // Temporal: NotificationService exige rol de supervisor para mensajes directos hasta contar con autenticación entre servicios.
        "X-Rol": "supervisor",
      },
      body: JSON.stringify({
        id_empleado_destinatario: supervisor.id_empleado,
        remitente_nombre: `${nombre} (solicitud de vacaciones)`,
        asunto: `Solicitud de vacaciones de ${nombre}`,
        contenido:
          `${nombre} solicitó vacaciones del ${formatearFecha(solicitud.fecha_inicio)} ` +
          `al ${formatearFecha(solicitud.fecha_fin)} (${solicitud.dias_habiles} días hábiles). ` +
          "La solicitud está pendiente de su aprobación.",
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    return respuesta.ok;
  } catch {
    return false;
  }
}

module.exports = { avisarSolicitudVacaciones };
