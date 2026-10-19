const modelo = require("../models/eventos.model");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const {
  TIPO_EVENTO,
  TOPICO,
  MAXIMO_INTENTOS,
  topicosDelArea,
  esperaReintento,
  armarCargaPublicacion,
} = require("../utils/eventos");

const TIEMPO_ESPERA_MS = 5000;
const LOTE = 10;
const SEGUNDOS_RESERVA = 60;
const LIMITE_CONSULTA = 100;

// Destino de cada tópico; sin URL, el evento queda pendiente para que el módulo lo consulte.
const destinos = () => ({
  [TOPICO.PRODUCCION_LOGISTICA]: process.env.URL_PRODUCCION_LOGISTICA || null,
  [TOPICO.ENTREGAS_DESPACHOS]: process.env.URL_ENTREGAS_DESPACHOS || null,
  [TOPICO.COMPENSACIONES]: process.env.URL_COMPENSACIONES || null,
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
  const carga = armarCargaPublicacion(detalle);
  for (const topico of topicos) {
    await modelo.registrar(cliente, {
      topico,
      tipoEvento: TIPO_EVENTO.ROL_TURNOS_PUBLICADO,
      idRol: detalle.id_rol,
      carga: { ...carga, topico },
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

async function enviar(evento, url) {
  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Evento-Id": evento.id_evento, "X-Topico": evento.topico },
      body: JSON.stringify(evento.carga),
      signal: AbortSignal.timeout(TIEMPO_ESPERA_MS),
    });
    if (respuesta.ok) {
      await modelo.marcarEntregado(evento.id_evento);
      return;
    }
    throw new Error(`El destino respondió ${respuesta.status}`);
  } catch (error) {
    const intentos = evento.intentos + 1;
    await modelo.marcarError(evento.id_evento, {
      error: error.name === "TimeoutError" ? "El destino no respondió a tiempo" : error.message,
      esperaMs: esperaReintento(intentos),
      fallido: intentos >= MAXIMO_INTENTOS,
    });
  }
}

async function despachar() {
  const urls = destinos();
  const topicos = Object.keys(urls).filter((topico) => urls[topico]);
  if (topicos.length === 0) return 0;
  const eventos = await modelo.reservarPendientes(topicos, LOTE, SEGUNDOS_RESERVA);
  await Promise.all(eventos.map((evento) => enviar(evento, urls[evento.topico])));
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
    errores.push({ campo: "topico", mensaje: `Use uno de: ${Object.values(TOPICO).join(", ")}.` });
  }
  if (estado !== undefined && !["PENDIENTE", "ENTREGADO", "FALLIDO"].includes(estado)) {
    errores.push({ campo: "estado", mensaje: "Use PENDIENTE, ENTREGADO o FALLIDO." });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  const eventos = await modelo.listar({ topico: topico ?? null, estado: estado ?? null, limite: LIMITE_CONSULTA });
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

module.exports = {
  registrarPublicacion,
  registrarConsolidacion,
  despachar,
  iniciarDespachador,
  listarDeRol,
  listar,
  confirmar,
};
