const pool = require("../config/db");
const modelo = require("../models/confirmaciones.model");
const planillas = require("../models/planillas.model");
const eventos = require("../models/eventos.model");
const pubsub = require("../config/pubsub");
const externos = require("./externos.service");
const { responsableEn } = require("./planillas.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { validarResponsable } = require("../utils/planillas");
const {
  MAXIMO_INTENTOS_ENTRADA,
  esperaNuevaEntrega,
  esConfirmacion,
  leerConfirmacion,
} = require("../utils/integraciones");

const ESTADOS = ["RECIBIDO", "PROCESADO", "IGNORADO", "FALLIDO"];
const LIMITE_CONSULTA = 100;
const REINTENTO_SUSCRIPCION_MS = 60 * 1000;
const NOMBRE = { CONTABILIDAD: "Contabilidad", PAGOS: "Pagos" };
const CAMPO = { CONTABILIDAD: "contabilidad", PAGOS: "pagos" };

// Un mensaje que no se arregla reintentando: queda FALLIDO sin volver a entregarse.
class ErrorPermanente extends Error {
  constructor(mensaje, idPlanilla = null) {
    super(mensaje);
    this.idPlanilla = idPlanilla;
  }
}

// Aplica la respuesta a la planilla. Criterio 4: con ambas confirmaciones la planilla queda CERRADA.
async function aplicar(cliente, c) {
  const planilla = await planillas.bloquear(cliente, c.idPlanilla);
  if (!planilla) throw new ErrorPermanente(`La planilla ${c.idPlanilla} no existe.`);
  if (planilla.estado === "BORRADOR") {
    throw new ErrorPermanente("La planilla está en borrador: todavía no se envió.", planilla.id_planilla);
  }
  const envio = await eventos.obtener(cliente, c.idMensajeOrigen);
  if (!envio || envio.id_planilla !== planilla.id_planilla || envio.destino !== c.destino) {
    throw new ErrorPermanente(
      `El mensaje ${c.idMensajeOrigen} no es un envío de esta planilla a ${NOMBRE[c.destino]}.`,
      planilla.id_planilla
    );
  }
  const ultimo = (await eventos.ultimosDePlanilla(cliente, planilla.id_planilla))[c.destino];
  if (ultimo.id_evento !== envio.id_evento) {
    return { estado: "IGNORADO", detalle: "Responde a un envío anterior: la planilla se reenvió después." };
  }
  if (planilla[`estado_${CAMPO[c.destino]}`] === "CONFIRMADA") {
    return { estado: "IGNORADO", detalle: `${NOMBRE[c.destino]} ya había confirmado la planilla.` };
  }
  await planillas.responder(cliente, planilla.id_planilla, c.destino, c);
  const cerrada = await planillas.cerrarSiConfirmada(cliente, planilla.id_planilla);
  return { estado: "PROCESADO", detalle: cerrada ? "Planilla cerrada." : null };
}

// Procesa una entrega de Pub/Sub. Devuelve { ack: true } o { ack: false, esperaMs } para que vuelva a entregarse.
async function procesar({ idMensaje, topico, cuerpo }) {
  if (!esConfirmacion(cuerpo)) return { ack: true, ignorado: true };
  const registro = {
    idMensaje: String(cuerpo.encabezado.id_mensaje ?? idMensaje).slice(0, 100),
    topico,
    tipoEvento: cuerpo.encabezado.tipo,
    origen: String(cuerpo.encabezado.origen?.grupo ?? "").slice(0, 10) || null,
    carga: cuerpo,
  };
  try {
    return await enTransaccion(async (cliente) => {
      const fila = await modelo.reclamar(cliente, registro);
      // Pub/Sub puede entregar dos veces el mismo mensaje: el duplicado no cambia nada.
      if (fila.estado !== "RECIBIDO") return { ack: true, duplicado: true };
      const confirmacion = leerConfirmacion(cuerpo);
      if (confirmacion.errores) {
        await modelo.cerrar(cliente, fila.id_evento_entrante, { estado: "FALLIDO", detalle: confirmacion.errores.join(" ") });
        return { ack: true };
      }
      await cliente.query("SAVEPOINT aplicar");
      try {
        const resultado = await aplicar(cliente, confirmacion);
        await modelo.cerrar(cliente, fila.id_evento_entrante, {
          ...resultado,
          idPlanilla: confirmacion.idPlanilla,
          destino: confirmacion.destino,
        });
      } catch (error) {
        if (!(error instanceof ErrorPermanente)) throw error;
        await cliente.query("ROLLBACK TO SAVEPOINT aplicar");
        await modelo.cerrar(cliente, fila.id_evento_entrante, {
          estado: "FALLIDO",
          detalle: error.message,
          idPlanilla: error.idPlanilla,
          destino: confirmacion.destino,
        });
      }
      return { ack: true };
    });
  } catch (error) {
    console.error(`Error al procesar la confirmación ${registro.idMensaje}:`, error.message);
    try {
      const fila = await modelo.registrarFallo({ ...registro, detalle: error.message, maximo: MAXIMO_INTENTOS_ENTRADA });
      if (!fila || fila.estado === "FALLIDO") return { ack: true };
      return { ack: false, esperaMs: esperaNuevaEntrega(fila.intentos) };
    } catch {
      return { ack: false, esperaMs: esperaNuevaEntrega(MAXIMO_INTENTOS_ENTRADA) };
    }
  }
}

async function manejar(mensaje, topico) {
  let cuerpo;
  try {
    cuerpo = JSON.parse(mensaje.data.toString("utf8"));
  } catch {
    mensaje.ack(); // No es JSON: no es una confirmación para RRHH.
    return;
  }
  const resultado = await procesar({ idMensaje: mensaje.id, topico, cuerpo });
  if (resultado.ack) mensaje.ack();
  else setTimeout(() => mensaje.nack(), resultado.esperaMs).unref();
}

// Contabilidad y Pagos publican en sus propios tópicos; RRHH los lee con suscripciones propias, que crea si faltan.
function topicosDeConfirmacion() {
  return (process.env.PUBSUB_TOPICOS_CONFIRMACION ?? "ucb-sis323-sub-d,ucb-sis323-sub-a")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

async function escuchar(clientePubSub, topico) {
  const nombre = `${topico}${process.env.PUBSUB_SUFIJO_SUSCRIPCION || "-rrhh-planillas"}`;
  const volverAIntentar = () => setTimeout(() => escuchar(clientePubSub, topico), REINTENTO_SUSCRIPCION_MS).unref();
  try {
    const suscripcion = clientePubSub.subscription(nombre);
    const [existe] = await suscripcion.exists();
    if (!existe) await clientePubSub.topic(topico).createSubscription(nombre);
    suscripcion.on("message", (mensaje) => manejar(mensaje, topico));
    suscripcion.on("error", (error) => {
      console.error(`Error en la suscripción ${nombre}:`, error.message);
      suscripcion.removeAllListeners();
      suscripcion.close().catch(() => {});
      volverAIntentar();
    });
    console.log(`Escuchando confirmaciones en ${nombre}`);
  } catch (error) {
    console.error(`No se pudo abrir la suscripción ${nombre}:`, error.message);
    volverAIntentar();
  }
}

function iniciarConsumidor() {
  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) return;
  for (const topico of topicosDeConfirmacion()) escuchar(clientePubSub, topico);
}

const formatear = (f) => ({
  id_evento_entrante: f.id_evento_entrante,
  id_mensaje: f.id_mensaje,
  topico: f.topico,
  tipo_evento: f.tipo_evento,
  origen: f.origen,
  id_planilla: f.id_planilla,
  destino: f.destino,
  estado: f.estado,
  intentos: f.intentos,
  detalle: f.detalle,
  recibido_en: f.recibido_en,
  procesado_en: f.procesado_en,
  carga: f.carga,
});

async function autorizar(identidad) {
  const id = validarResponsable(identidad);
  responsableEn(await externos.listarPersonal(), id);
}

// Mensajes recibidos; con estado=FALLIDO, la cola de mensajes fallidos.
async function listar({ estado } = {}, identidad = {}) {
  await autorizar(identidad);
  if (estado !== undefined && !ESTADOS.includes(estado)) {
    throw new ErrorApp(400, "Filtros inválidos", [{ campo: "estado", mensaje: `Use uno de: ${ESTADOS.join(", ")}.` }]);
  }
  return (await modelo.listar({ estado: estado ?? null, limite: LIMITE_CONSULTA })).map(formatear);
}

// Vuelve a procesar un mensaje fallido (por ejemplo, tras corregir el dato que faltaba).
async function reprocesar(id, identidad = {}) {
  await autorizar(identidad);
  const actual = UUID_RE.test(id ?? "") ? await modelo.obtener(pool, id) : undefined;
  if (!actual) throw new ErrorApp(404, "Mensaje no encontrado");
  const fila = await modelo.reabrir(id);
  if (!fila) throw new ErrorApp(409, "Solo se reprocesan los mensajes fallidos.");
  const resultado = await procesar({ idMensaje: fila.id_mensaje, topico: fila.topico, cuerpo: fila.carga });
  if (!resultado.ack) {
    const tras = await modelo.obtener(pool, id);
    await modelo.devolverAFallido(id, tras.detalle ?? "No se pudo procesar.");
    throw new ErrorApp(503, `No se pudo reprocesar el mensaje: ${tras.detalle ?? "error al procesar"}. Intente más tarde.`);
  }
  return formatear(await modelo.obtener(pool, id));
}

module.exports = { procesar, iniciarConsumidor, listar, reprocesar, ErrorPermanente };
