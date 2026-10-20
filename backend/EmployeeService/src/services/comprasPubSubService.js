const fs = require('node:fs');

const TIEMPO_ESPERA_MS = 10000;
const TIPO_SOLICITUD_COMPRA = 'SOLICITUD_COMPRA_CAPACITACION';
const VERSION_ESQUEMA = 1;
const ORIGEN = { grupo: 'F', modulo: 'RRHH' };
const DESTINO = { grupo: 'C', modulo: 'Compras y Proveedores' };

let topico = null;

const configuracion = () => ({
  projectId: process.env.PUBSUB_PROJECT_ID,
  topic: process.env.PUBSUB_TOPIC_COMPRAS,
  credenciales: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const faltaConfiguracion = () => {
  const { projectId, topic, credenciales } = configuracion();
  if (!projectId) return 'falta PUBSUB_PROJECT_ID';
  if (!topic) return 'falta PUBSUB_TOPIC_COMPRAS';
  if (!credenciales) return 'falta GOOGLE_APPLICATION_CREDENTIALS';
  if (!fs.existsSync(credenciales)) return `no existe el archivo de credenciales ${credenciales}`;
  return null;
};

const obtenerTopico = () => {
  if (!topico) {
    const { PubSub } = require('@google-cloud/pubsub');
    const { projectId, topic } = configuracion();
    topico = new PubSub({ projectId }).topic(topic);
  }
  return topico;
};

const conLimiteDeTiempo = (promesa) =>
  Promise.race([
    promesa,
    new Promise((_, rechazar) => {
      setTimeout(() => rechazar(new Error(`Pub/Sub no respondió en ${TIEMPO_ESPERA_MS / 1000} s.`)), TIEMPO_ESPERA_MS).unref();
    }),
  ]);

const construirMensaje = (tipo, idMensaje, fecha, datos) => ({
  atributos: {
    id_mensaje: idMensaje,
    origen: ORIGEN.grupo,
    origen_modulo: ORIGEN.modulo,
    destino: DESTINO.grupo,
    destino_modulo: DESTINO.modulo,
    tipo,
    version_esquema: String(VERSION_ESQUEMA),
  },
  cuerpo: {
    encabezado: {
      id_mensaje: idMensaje,
      origen: ORIGEN,
      destino: DESTINO,
      tipo,
      fecha: new Date(fecha).toISOString(),
      version_esquema: VERSION_ESQUEMA,
    },
    datos,
  },
});

const mensajeSolicitudCompra = (solicitud) =>
  construirMensaje(TIPO_SOLICITUD_COMPRA, solicitud.id_mensaje, solicitud.registrado_en, {
    id_solicitud_servicio: solicitud.id_solicitud_servicio,
    curso: {
      id_curso: solicitud.id_curso,
      codigo: solicitud.curso_codigo,
      nombre: solicitud.curso,
      tipo_capacitacion: solicitud.tipo_capacitacion,
      horas_academicas: solicitud.horas_academicas,
    },
    descripcion_requerimiento: solicitud.descripcion_requerimiento,
    cantidad_participantes: solicitud.cantidad_participantes,
    fecha_requerida: solicitud.fecha_requerida,
    monto_estimado: solicitud.monto_estimado,
    solicitante: {
      id_empleado: solicitud.id_empleado_solicitante,
      nombre: solicitud.solicitante,
    },
  });

const publicarSolicitudCompraCapacitacion = async (solicitud) => {
  const mensaje = mensajeSolicitudCompra(solicitud);

  const motivo = faltaConfiguracion();
  if (motivo) throw new Error(`Pub/Sub no está configurado: ${motivo}.`);

  const idPubSub = await conLimiteDeTiempo(
    obtenerTopico().publishMessage({ data: Buffer.from(JSON.stringify(mensaje.cuerpo)), attributes: mensaje.atributos })
  );
  return { id_pubsub: idPubSub, mensaje };
};

module.exports = { publicarSolicitudCompraCapacitacion, mensajeSolicitudCompra };
