const { USUARIO_SISTEMA } = require('./notificacionesService');
const { formatearFecha } = require('../utils/fechas');

const URL_NOTIFICACIONES = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007';
const TIEMPO_ESPERA_MS = 15000;
const REMITENTE = 'Recursos Humanos - Convocatorias internas';

const describirAntiguedad = (meses) => `${meses} ${meses === 1 ? 'mes' : 'meses'} de antigüedad`;

const armarMensaje = (convocatoria) => ({
  asunto: `Convocatoria interna: ${convocatoria.titulo}`,
  contenido: [
    `Recursos Humanos abrió una convocatoria de ascenso para el cargo «${convocatoria.cargo}» en la sucursal ${convocatoria.sucursal}.`,
    '',
    `Requisitos: ${convocatoria.descripcion_requisitos}`,
    `Antigüedad mínima: ${describirAntiguedad(convocatoria.meses_antiguedad_minima)}.`,
    `Nota mínima de desempeño: ${convocatoria.nota_minima_desempeno} sobre 100.`,
    '',
    `Postulaciones del ${formatearFecha(convocatoria.fecha_inicio_postulacion)} al ${formatearFecha(convocatoria.fecha_cierre_postulacion)}.`,
    'Consulte el detalle en «Convocatorias de ascenso» del portal del empleado. Es exclusiva para empleados activos.',
  ].join('\n'),
});

const notificarConvocatoria = async (convocatoria, { idPublicador } = {}) => {
  const { asunto, contenido } = armarMensaje(convocatoria);
  try {
    const respuesta = await fetch(`${URL_NOTIFICACIONES}/comunicaciones/institucional`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rol': 'admin',
        'X-Usuario-Id': idPublicador || USUARIO_SISTEMA,
      },
      body: JSON.stringify({
        tipo_codigo: 'COMUNICADO',
        alcance_codigo: 'GENERAL',
        asunto,
        contenido,
        requiere_confirmacion: false,
        remitente_nombre: REMITENTE,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    const cuerpo = await respuesta.json().catch(() => null);
    if (!respuesta.ok) {
      return { entregada: false, error: `NotificationService respondió ${respuesta.status}: ${cuerpo?.error || 'sin detalle'}` };
    }
    return { entregada: true, destinatarios: Number(cuerpo?.cantidad_destinatarios) || 0 };
  } catch (error) {
    return { entregada: false, error: `No se pudo contactar a NotificationService: ${error.message}` };
  }
};

module.exports = { notificarConvocatoria, armarMensaje };
