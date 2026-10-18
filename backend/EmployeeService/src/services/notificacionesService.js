const URL_NOTIFICACIONES = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007';
const TIEMPO_ESPERA_MS = 5000;
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

const describirCertificacion = (c) =>
  `«${c.curso}» (${c.curso_codigo}) emitida por ${c.institucion_emisora}, vence el ${c.fecha_vencimiento}`;

const alertarColaborador = (certificacion, dias) =>
  enviarMensajeDirecto({
    id_empleado_destinatario: certificacion.id_empleado,
    correo: certificacion.correo_personal,
    asunto: `Su certificación «${certificacion.curso}» vence en ${dias} días`,
    contenido:
      `Estimado(a) ${certificacion.empleado}:\n\n` +
      `Le recordamos que su certificación ${describirCertificacion(certificacion)}. ` +
      'Coordine su renovación con Recursos Humanos antes de esa fecha para mantener su expediente al día.',
  });

const alertarRRHH = (certificaciones, dias) =>
  enviarMensajeDirecto({
    id_empleado_destinatario: process.env.ALERTAS_ID_EMPLEADO_RRHH || 'RRHH',
    correo: process.env.ALERTAS_CORREO_RRHH,
    asunto: `${certificaciones.length} certificación(es) del personal vencen en ${dias} días`,
    contenido:
      `Las siguientes certificaciones vencen dentro de ${dias} días:\n\n` +
      certificaciones.map((c) => `- ${c.empleado}: ${describirCertificacion(c)}`).join('\n'),
  });

module.exports = { alertarColaborador, alertarRRHH };
