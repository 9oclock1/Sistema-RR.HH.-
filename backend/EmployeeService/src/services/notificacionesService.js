const URL_NOTIFICACIONES = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007';
const TIEMPO_ESPERA_MS = 5000;

// Remitente de los avisos automáticos (sin persona detrás). Debe ser un UUID válido para NotificationService.
const USUARIO_SISTEMA = '00000000-0000-4000-8000-000000000001';

// Deja un mensaje de alta prioridad en la bandeja del destinatario y le avisa por correo.
// Devuelve false si NotificationService no lo aceptó; quien llama decide si reintenta.
const enviarAvisoPrioritario = async ({ idRemitente, remitenteNombre, idDestinatario, asunto, contenido, enlace }) => {
  try {
    const respuesta = await fetch(`${URL_NOTIFICACIONES}/comunicaciones/directa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Empleado-Id': idRemitente,
        // Temporal: NotificationService exige un rol emisor para mensajes directos hasta contar con autenticación entre servicios.
        'X-Rol': 'admin',
      },
      body: JSON.stringify({
        id_empleado_destinatario: idDestinatario,
        remitente_nombre: remitenteNombre,
        asunto,
        contenido,
        prioridad: 'ALTA',
        notificar_correo: true,
        enlace,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (!respuesta.ok) {
      const cuerpo = await respuesta.json().catch(() => null);
      console.error(`NotificationService rechazó el aviso (${respuesta.status}): ${cuerpo?.error || 'sin detalle'}`);
    }
    return respuesta.ok;
  } catch (error) {
    console.error('No se pudo contactar a NotificationService:', error.message);
    return false;
  }
};

module.exports = { enviarAvisoPrioritario, USUARIO_SISTEMA };
