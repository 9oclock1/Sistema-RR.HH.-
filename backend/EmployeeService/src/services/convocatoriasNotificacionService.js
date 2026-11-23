const { USUARIO_SISTEMA } = require('./notificacionesService');
const { formatearFecha } = require('../utils/fechas');

const URL_NOTIFICACIONES = process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:3007';
const TIEMPO_ESPERA_MS = 15000;
const REMITENTE = 'Recursos Humanos - Convocatorias internas';

const describirMeses = (meses) => `${meses} ${meses === 1 ? 'mes' : 'meses'}`;

const armarMensaje = (convocatoria, destinatario) => ({
  asunto: `Convocatoria interna: ${convocatoria.titulo}`,
  contenido: [
    `${destinatario.nombres}, Recursos Humanos abrió una convocatoria de ascenso para el cargo «${convocatoria.cargo}» en la sucursal ${convocatoria.sucursal}.`,
    `Le llega este aviso porque cumple la antigüedad mínima de ${describirMeses(convocatoria.meses_antiguedad_minima)} (usted tiene ${describirMeses(destinatario.meses_antiguedad)} al cierre).`,
    '',
    `Requisitos: ${convocatoria.descripcion_requisitos}`,
    `Nota mínima de desempeño: ${convocatoria.nota_minima_desempeno} sobre 100. Se valida con su última evaluación al postularse.`,
    '',
    `Postulaciones del ${formatearFecha(convocatoria.fecha_inicio_postulacion)} al ${formatearFecha(convocatoria.fecha_cierre_postulacion)}.`,
    'Consulte el detalle y postúlese en «Convocatorias de ascenso» del portal del empleado.',
  ].join('\n'),
});

const enviarDirecta = async ({ idEmpleado, asunto, contenido, idRemitente }) => {
  try {
    const respuesta = await fetch(`${URL_NOTIFICACIONES}/comunicaciones/directa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Rol': 'admin',
        'X-Usuario-Id': idRemitente || USUARIO_SISTEMA,
      },
      body: JSON.stringify({
        id_empleado_destinatario: idEmpleado,
        asunto,
        contenido,
        requiere_confirmacion: false,
        remitente_nombre: REMITENTE,
      }),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) return { entregada: true };
    const cuerpo = await respuesta.json().catch(() => null);
    return { entregada: false, error: `NotificationService respondió ${respuesta.status}: ${cuerpo?.error || 'sin detalle'}` };
  } catch (error) {
    return { entregada: false, error: `No se pudo contactar a NotificationService: ${error.message}` };
  }
};

const avisarElegible = (convocatoria, destinatario, { idPublicador } = {}) =>
  enviarDirecta({ idEmpleado: destinatario.id_empleado, idRemitente: idPublicador, ...armarMensaje(convocatoria, destinatario) });

const montoBs = new Intl.NumberFormat('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// KAN-84 (criterio 4): aviso al empleado promovido con su nuevo cargo, haber y fecha de vigencia.
const armarMensajeAscenso = ({ nombres, convocatoria, cargo, sucursal, ascenso }) => ({
  asunto: `Ascenso formalizado: ${cargo.nombre}`,
  contenido: [
    `${nombres}, Recursos Humanos formalizó su ascenso por la convocatoria interna «${convocatoria.titulo}».`,
    '',
    `Nuevo cargo: ${cargo.nombre} (${sucursal}).`,
    `Nivel salarial: ${cargo.nivel_salarial}.`,
    cargo.cargo_jefe_directo ? `Reporta a: ${cargo.cargo_jefe_directo}.` : null,
    `Haber mensual: Bs ${montoBs.format(ascenso.haber_mensual_pactado)}.`,
    `Vigente desde el ${formatearFecha(ascenso.fecha_vigencia)}.`,
    '',
    `El cambio quedó registrado como adenda ${ascenso.numero_contrato} en su historial contractual.`,
  ]
    .filter((linea) => linea !== null)
    .join('\n'),
});

const avisarAscenso = (datos, { idRemitente } = {}) =>
  enviarDirecta({ idEmpleado: datos.id_empleado, idRemitente, ...armarMensajeAscenso(datos) });

module.exports = { avisarElegible, armarMensaje, avisarAscenso, armarMensajeAscenso };
