const URL_NOTIFICACIONES = process.env.NOTIFICATION_SERVICE_URL || "http://notification-service:3007";
const TIEMPO_ESPERA_MS = 5000;

// Temporal: NotificationService exige un rol emisor hasta contar con autenticación entre servicios.
// Quien resuelve ya pasó el control de rol de AttendanceService.
const ROL_EMISOR = "supervisor";

// Avisa al colaborador el resultado de su solicitud (RF-34).
// Devuelve { aceptada, reintentable }: un 4xx distinto de 408/429 no mejora reintentando.
async function notificarResolucion({ solicitud, idResolutor, nombreResolutor }) {
  const cuerpo = {
    id_solicitud: solicitud.id_solicitud,
    id_empleado: solicitud.id_empleado,
    estado: solicitud.estado_codigo,
    tipo_solicitud: solicitud.tipo_nombre,
    fecha_inicio: solicitud.fecha_inicio,
    fecha_fin: solicitud.fecha_fin,
    motivo_resolucion: solicitud.motivo_resolucion,
    resuelto_por_nombre: nombreResolutor,
  };
  try {
    const respuesta = await fetch(`${URL_NOTIFICACIONES}/notificaciones/resolucion-solicitud`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Empleado-Id": idResolutor, "X-Rol": ROL_EMISOR },
      body: JSON.stringify(cuerpo),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) return { aceptada: true, reintentable: false };
    const detalle = await respuesta.json().catch(() => null);
    console.error(`NotificationService rechazó el aviso de la solicitud ${solicitud.id_solicitud} (${respuesta.status}): ${detalle?.error ?? "sin detalle"}`);
    const reintentable = respuesta.status >= 500 || respuesta.status === 408 || respuesta.status === 429;
    return { aceptada: false, reintentable };
  } catch (error) {
    console.error(`No se pudo contactar a NotificationService (solicitud ${solicitud.id_solicitud}):`, error.message);
    return { aceptada: false, reintentable: true };
  }
}

module.exports = { notificarResolucion };
