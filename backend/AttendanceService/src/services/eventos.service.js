const { randomUUID } = require("node:crypto");
const modelo = require("../models/eventos.model");
const pubsub = require("../config/pubsub");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const {
  TIPO_EVENTO,
  TOPICO,
  ORIGEN,
  DESTINOS,
  MAXIMO_INTENTOS,
  topicosDelArea,
  esperaReintento,
  topicoDelGrupo,
  armarMensaje,
  atributosDe,
  errorDePublicacion,
  armarCargaPublicacion,
  armarCargaIndisponibilidad,
} = require("../utils/eventos");

const TIEMPO_ESPERA_MS = 5000;
// Sin tope, una publicación a Pub/Sub inalcanzable queda colgada y el evento no se reintenta.
const TIEMPO_PUBLICACION_MS = 15000;
const LOTE = 10;
const SEGUNDOS_RESERVA = 60;
const LIMITE_CONSULTA = 100;

const prefijoTopico = () =>
  process.env.PUBSUB_PREFIJO_TOPICO || "ucb-sis323-sub-";

// Destinos con endpoint REST propio. Producción y Entregas lo usan para la indisponibilidad (KAN-53) y, si el
// endpoint falla, el evento sigue por Pub/Sub.
const destinosHttp = () => ({
  [TOPICO.COMPENSACIONES]: process.env.URL_COMPENSACIONES || null,
  [TOPICO.PRODUCCION_LOGISTICA]: process.env.URL_PRODUCCION_LOGISTICA || null,
  [TOPICO.ENTREGAS_DESPACHOS]: process.env.URL_ENTREGAS_DESPACHOS || null,
});

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

// Se llama dentro de la transacción que consolida la jornada (o un periodo de horas extra) o la recalcula al aprobar un justificativo.
async function registrarConsolidacion(cliente, carga) {
  await modelo.registrar(cliente, {
    topico: TOPICO.COMPENSACIONES,
    tipoEvento: carga.evento ?? TIPO_EVENTO.JORNADA_CONSOLIDADA,
    idRol: null,
    carga: { ...carga, topico: TOPICO.COMPENSACIONES },
  });
}

// KAN-53: se llama dentro de la transacción que aprueba la ausencia. Un evento por módulo que debe enterarse.
// Devuelve cuántos eventos quedaron registrados (0 si el área no corresponde a Producción ni a Entregas).
async function registrarIndisponibilidad(cliente, datos) {
  const topicos = topicosDe(datos.ubicacion.area_codigo);
  const carga = armarCargaIndisponibilidad(datos);
  const fecha = new Date().toISOString();
  for (const topico of topicos) {
    const idEvento = randomUUID();
    await modelo.registrar(cliente, {
      idEvento,
      topico,
      tipoEvento: TIPO_EVENTO.PERSONAL_NO_DISPONIBLE,
      idRol: null,
      carga: armarMensaje({
        idMensaje: idEvento,
        destino: DESTINOS[topico],
        tipo: TIPO_EVENTO.PERSONAL_NO_DISPONIBLE,
        fecha,
        datos: carga,
      }),
    });
  }
  return topicos.length;
}

async function publicar(clientePubSub, evento) {
  const topico = topicoDelGrupo(prefijoTopico(), ORIGEN.grupo);
  try {
    const idMensaje = await Promise.race([
      clientePubSub.topic(topico).publishMessage({
        json: evento.carga,
        attributes: atributosDe(evento.carga),
      }),
      new Promise((_, rechazar) =>
        setTimeout(() => rechazar(new Error("Pub/Sub no respondió a tiempo")), TIEMPO_PUBLICACION_MS).unref(),
      ),
    ]);
    console.log(`Evento ${evento.id_evento} publicado en ${topico} (mensaje ${idMensaje})`);
    mensajesPublicados.registrar({
      topico,
      idPubSub: idMensaje,
      atributos: atributosDe(evento.carga),
      cuerpo: evento.carga,
    });
    await modelo.marcarEntregado(evento.id_evento);
  } catch (error) {
    console.error(
      `Error al publicar el evento ${evento.id_evento} en ${topico}:`,
      error.message,
    );
    const { mensaje, permanente } = errorDePublicacion(error, topico);
    await modelo.marcarError(evento.id_evento, {
      error: mensaje,
      esperaMs: esperaReintento(evento.intentos + 1),
      fallido: permanente,
    });
  }
}

// Devuelve { ok } o { ok: false, error } sin tocar la base: quien llama decide qué hacer con el fallo.
async function intentarHttp(evento, url) {
  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Evento-Id": evento.id_evento,
        "X-Topico": evento.topico,
      },
      body: JSON.stringify(evento.carga),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) return { ok: true };
    return { ok: false, error: `El destino respondió ${respuesta.status}` };
  } catch (error) {
    return { ok: false, error: error.name === "TimeoutError" ? "El destino no respondió a tiempo" : error.message };
  }
}

async function enviarHttp(evento, url) {
  const resultado = await intentarHttp(evento, url);
  if (resultado.ok) {
    await modelo.marcarEntregado(evento.id_evento);
    return;
  }
  const intentos = evento.intentos + 1;
  await modelo.marcarError(evento.id_evento, {
    error: resultado.error,
    esperaMs: esperaReintento(intentos),
    fallido: intentos >= MAXIMO_INTENTOS,
  });
}

// Con endpoint REST configurado se usa primero; si falla y hay Pub/Sub, el mensaje sale por ahí en ese mismo ciclo
// en lugar de esperar al reintento. Sin ninguno de los dos caminos, queda pendiente con espera creciente.
async function entregar(evento, clientePubSub, urls) {
  const url = urls[evento.topico];
  if (!url) return publicar(clientePubSub, evento);
  if (!DESTINOS[evento.topico] || !clientePubSub) return enviarHttp(evento, url);
  const resultado = await intentarHttp(evento, url);
  if (resultado.ok) {
    await modelo.marcarEntregado(evento.id_evento);
    return;
  }
  console.error(`El endpoint de ${evento.topico} falló (${resultado.error}); se publica por Pub/Sub.`);
  return publicar(clientePubSub, evento);
}

// Envía a Pub/Sub los eventos pendientes; sin Pub/Sub configurado quedan en la base hasta que lo esté.
async function despachar() {
  const clientePubSub = pubsub.obtenerCliente();
  const urls = destinosHttp();
  const topicos = [
    ...new Set([
      ...(clientePubSub ? Object.keys(DESTINOS) : []),
      ...Object.keys(urls).filter((topico) => urls[topico]),
    ]),
  ];
  if (topicos.length === 0) return 0;
  const eventos = await modelo.reservarPendientes(
    topicos,
    LOTE,
    SEGUNDOS_RESERVA,
  );
  await Promise.all(eventos.map((evento) => entregar(evento, clientePubSub, urls)));
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

// Consulta para los módulos que leen los eventos en lugar de recibirlos.
async function listar({ topico, estado } = {}) {
  const errores = [];
  if (topico !== undefined && !Object.values(TOPICO).includes(topico)) {
    errores.push({
      campo: "topico",
      mensaje: `Use uno de: ${Object.values(TOPICO).join(", ")}.`,
    });
  }
  if (
    estado !== undefined &&
    !["PENDIENTE", "ENTREGADO", "FALLIDO"].includes(estado)
  ) {
    errores.push({
      campo: "estado",
      mensaje: "Use PENDIENTE, ENTREGADO o FALLIDO.",
    });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  const eventos = await modelo.listar({
    topico: topico ?? null,
    estado: estado ?? null,
    limite: LIMITE_CONSULTA,
  });
  return eventos.map((evento) => ({
    id_evento: evento.id_evento,
    topico: evento.topico,
    tipo_evento: evento.tipo_evento,
    estado: evento.estado_codigo,
    creado_en: evento.creado_en,
    carga: evento.carga,
  }));
}

// El módulo consumidor confirma que procesó el evento.
async function confirmar(id) {
  const evento = UUID_RE.test(id) ? await modelo.obtener(id) : undefined;
  if (!evento) throw new ErrorApp(404, "Evento no encontrado");
  await modelo.marcarEntregado(evento.id_evento);
  return resumir(await modelo.obtener(evento.id_evento));
}

// Un operador reenvía un evento que agotó sus reintentos (p. ej. tras arreglar el endpoint del ERP).
async function reintentar(id) {
  const evento = UUID_RE.test(id) ? await modelo.obtener(id) : undefined;
  if (!evento) throw new ErrorApp(404, "Evento no encontrado");
  if (evento.estado_codigo !== "FALLIDO") {
    throw new ErrorApp(409, "Solo se pueden reintentar los eventos fallidos.");
  }
  await modelo.reencolar(evento.id_evento);
  return resumir(await modelo.obtener(evento.id_evento));
}

module.exports = {
  registrarPublicacion,
  registrarIndisponibilidad,
  registrarConsolidacion,
  despachar,
  iniciarDespachador,
  listarDeRol,
  listar,
  confirmar,
  reintentar,
};
