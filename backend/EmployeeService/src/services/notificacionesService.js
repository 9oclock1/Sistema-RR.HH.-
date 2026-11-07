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

const REMITENTE_NOMBRE = 'Sistema de RRHH (alertas automáticas)';

const modoSimulado = () =>
  process.env.NOTIFICACIONES_SIMULADAS === 'true' || !process.env.ALERTAS_ID_EMPLEADO_RRHH;

const simularEnvio = ({ id_empleado_destinatario, correo, asunto, contenido }) => {
  console.log(
    `[notificaciones simuladas] Para: ${id_empleado_destinatario}${correo ? ` <${correo}>` : ''}\nAsunto: ${asunto}\n${contenido}`
  );
  return { simulado: true };
};

const enviarMensajeDirecto = async (mensaje) => {
  if (modoSimulado()) return simularEnvio(mensaje);

  const respuesta = await fetch(`${URL_NOTIFICACIONES}/comunicaciones/directa`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Usuario-Id': process.env.ALERTAS_ID_EMPLEADO_RRHH,
      'X-Rol': 'admin',
    },
    body: JSON.stringify({
      id_empleado_destinatario: mensaje.id_empleado_destinatario,
      asunto: mensaje.asunto,
      contenido: mensaje.contenido,
      requiere_confirmacion: false,
      remitente_nombre: REMITENTE_NOMBRE,
    }),
    signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text().catch(() => '');
    throw new Error(`NotificationService respondió ${respuesta.status}: ${detalle}`);
  }
  return respuesta.json();
};

const plazo = (dias) => {
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  return `vence en ${dias} días`;
};

const describirCertificacion = (c) =>
  `«${c.curso}» (${c.curso_codigo}) emitida por ${c.institucion_emisora}, vence el ${c.fecha_vencimiento}`;

const alertarColaborador = (certificacion) =>
  enviarMensajeDirecto({
    id_empleado_destinatario: certificacion.id_empleado,
    correo: certificacion.correo_personal,
    asunto: `Su certificación «${certificacion.curso}» ${plazo(certificacion.dias_para_vencer)}`,
    contenido:
      `Estimado(a) ${certificacion.empleado}:\n\n` +
      `Le recordamos que su certificación ${describirCertificacion(certificacion)}. ` +
      'Coordine su renovación con Recursos Humanos antes de esa fecha para mantener su expediente al día.',
  });

const alertarRRHH = (certificaciones, diasAviso, idsSinAviso = new Set()) =>
  enviarMensajeDirecto({
    id_empleado_destinatario: process.env.ALERTAS_ID_EMPLEADO_RRHH || 'RRHH',
    correo: process.env.ALERTAS_CORREO_RRHH,
    asunto: `${certificaciones.length} certificación(es) del personal vencen en los próximos ${diasAviso} días`,
    contenido:
      `Las siguientes certificaciones vencen en los próximos ${diasAviso} días:\n\n` +
      certificaciones
        .map(
          (c) =>
            `- ${c.empleado}: ${describirCertificacion(c)} (${plazo(c.dias_para_vencer)})` +
            (idsSinAviso.has(c.id_capacitacion) ? ' — no se pudo avisar al colaborador' : '')
        )
        .join('\n'),
  });

module.exports = { enviarAvisoPrioritario, USUARIO_SISTEMA, alertarColaborador, alertarRRHH };
