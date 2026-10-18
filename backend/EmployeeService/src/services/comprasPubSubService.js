const fs = require('node:fs');
const { randomUUID } = require('node:crypto');

const TIEMPO_ESPERA_MS = 10000;
const ORIGEN = 'RRHH';
const DESTINO = 'COMPRAS';

let topico = null;

const configuracion = () => ({
  projectId: process.env.PUBSUB_PROJECT_ID,
  topic: process.env.PUBSUB_TOPIC_COMPRAS,
  credenciales: process.env.GOOGLE_APPLICATION_CREDENTIALS,
});

const modoSimulado = () => {
  const { projectId, topic, credenciales } = configuracion();
  return (
    process.env.PUBSUB_SIMULADO === 'true' || !projectId || !topic || !credenciales || !fs.existsSync(credenciales)
  );
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

const construirEvento = (tipo, datos) => ({
  id_evento: randomUUID(),
  tipo_evento: tipo,
  version: 1,
  origen: ORIGEN,
  destino: DESTINO,
  fecha_hora: new Date().toISOString(),
  datos,
});

const publicarEvento = async (evento) => {
  const atributos = { tipo_evento: evento.tipo_evento, origen: ORIGEN, destino: DESTINO };

  if (modoSimulado()) {
    console.log(`[pubsub simulado] ${evento.tipo_evento}\n${JSON.stringify(evento, null, 2)}`);
    return { id_mensaje: `simulado-${evento.id_evento}`, simulado: true };
  }

  const idMensaje = await conLimiteDeTiempo(
    obtenerTopico().publishMessage({ data: Buffer.from(JSON.stringify(evento)), attributes: atributos })
  );
  return { id_mensaje: idMensaje, simulado: false };
};

const publicarSolicitudCompraCapacitacion = (solicitud) => {
  const evento = construirEvento('SOLICITUD_COMPRA_CAPACITACION', {
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
  return publicarEvento(evento).then((resultado) => ({ ...resultado, evento }));
};

module.exports = { publicarSolicitudCompraCapacitacion };
