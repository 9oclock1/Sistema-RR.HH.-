const { randomUUID } = require("node:crypto");
const modelo = require("../models/eventos.model");
const pubsub = require("../config/pubsub");
const {
  TIPO_EVENTO,
  ORIGEN,
  DESTINOS,
  topicosDelArea,
  esperaReintento,
  topicoDelGrupo,
  armarMensaje,
  atributosDe,
  errorDePublicacion,
  armarCargaPublicacion,
} = require("../utils/eventos");

const LOTE = 10;
const SEGUNDOS_RESERVA = 60;

const prefijoTopico = () => process.env.PUBSUB_PREFIJO_TOPICO || "ucb-sis323-sub-";

// Además del tópico del grupo destino, una copia en el tópico propio (F), por si cada grupo lee el del remitente.
function topicosDeEnvio(grupoDestino) {
  const topicos = [topicoDelGrupo(prefijoTopico(), grupoDestino)];
  if (process.env.PUBSUB_COPIA_PROPIA !== "false") topicos.push(topicoDelGrupo(prefijoTopico(), ORIGEN.grupo));
  return topicos;
}

const topicosDe = (codigoArea) =>
  topicosDelArea(codigoArea, {
    areasProduccion: process.env.AREAS_PRODUCCION,
    areasReparto: process.env.AREAS_REPARTO,
  });

// Se llama dentro de la transacción de publicación: el evento existe solo si el rol se publicó.
async function registrarPublicacion(cliente, detalle) {
  const topicos = topicosDe(detalle.area.codigo);
  if (topicos.length === 0) return;
  const datos = armarCargaPublicacion(detalle);
  const fecha = new Date().toISOString();
  for (const topico of topicos) {
    const idEvento = randomUUID();
    await modelo.registrar(cliente, {
      idEvento,
      topico,
      tipoEvento: TIPO_EVENTO.ROL_TURNOS_PUBLICADO,
      idRol: detalle.id_rol,
      carga: armarMensaje({
        idMensaje: idEvento,
        destino: DESTINOS[topico],
        tipo: TIPO_EVENTO.ROL_TURNOS_PUBLICADO,
        fecha,
        datos,
      }),
    });
  }
}

// Si un tópico falla se reintenta el evento completo; los receptores descartan duplicados por id_mensaje.
async function publicar(clientePubSub, evento) {
  const topicos = topicosDeEnvio(DESTINOS[evento.topico].grupo);
  const mensaje = { json: evento.carga, attributes: atributosDe(evento.carga) };
  const resultados = await Promise.allSettled(topicos.map((topico) => clientePubSub.topic(topico).publishMessage(mensaje)));
  resultados.forEach((resultado, i) => {
    if (resultado.status === "fulfilled") {
      console.log(`Evento ${evento.id_evento} publicado en ${topicos[i]} (mensaje ${resultado.value})`);
    }
  });
  const fallo = resultados.findIndex((resultado) => resultado.status === "rejected");
  if (fallo === -1) {
    await modelo.marcarEntregado(evento.id_evento);
    return;
  }
  const topico = topicos[fallo];
  const error = resultados[fallo].reason;
  console.error(`Error al publicar el evento ${evento.id_evento} en ${topico}:`, error.message);
  const { mensaje: motivo, permanente } = errorDePublicacion(error, topico);
  await modelo.marcarError(evento.id_evento, {
    error: motivo,
    esperaMs: esperaReintento(evento.intentos + 1),
    fallido: permanente,
  });
}

// Envía a Pub/Sub los eventos pendientes; sin Pub/Sub configurado quedan en la base hasta que lo esté.
async function despachar() {
  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) return 0;
  const eventos = await modelo.reservarPendientes(Object.keys(DESTINOS), LOTE, SEGUNDOS_RESERVA);
  await Promise.all(eventos.map((evento) => publicar(clientePubSub, evento)));
  return eventos.length;
}

function iniciarDespachador() {
  const intervalo = Number(process.env.INTERVALO_EVENTOS_MS) || 5000;
  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await despachar();
    } catch (error) {
      console.error("Error al despachar eventos:", error.message);
    } finally {
      ocupado = false;
    }
  }, intervalo);
}

const resumir = (evento) => ({
  id_evento: evento.id_evento,
  topico: evento.topico,
  tipo_evento: evento.tipo_evento,
  estado: { codigo: evento.estado_codigo, nombre: evento.estado_nombre },
  intentos: evento.intentos,
  ultimo_error: evento.ultimo_error,
  entregado_en: evento.entregado_en,
  creado_en: evento.creado_en,
});

async function listarDeRol(idRol) {
  return (await modelo.listarPorRol(idRol)).map(resumir);
}

module.exports = { registrarPublicacion, despachar, iniciarDespachador, listarDeRol };
