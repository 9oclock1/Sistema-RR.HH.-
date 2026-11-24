const modelo = require("../models/finiquitosModel");
const pubsub = require("../config/pubsub");
const notificaciones = require("../clients/notificacionesCliente");
const { topicoPropio } = require("./eventos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { atributosDe } = require("../utils/integraciones");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { validarAdmin, validarConsulta } = require("../utils/desvinculaciones");
const {
  simulacionFiniquitoActiva,
  finiquitoMaximoIntentos,
  esperaReentregaFiniquito,
  validarFiltroEstadoEntrante,
  identificarMensajeFiniquito,
  leerConfirmacionFiniquito,
  clasificarPrestamosAlPagar,
  construirContenidoAvisoPrestamos,
} = require("../utils/finiquitos");

const LIMITE_LISTADO = 100;
const SEGUNDOS_REANUDAR = 30;
const enVuelo = new Set();

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function mostrarEnConsola({ cuerpo, idMensaje, origen, tipoEvento }, topico, idPubSub) {
  const modulo =
    cuerpo?.encabezado?.origen?.modulo ||
    (origen === "A" ? "Pagos y Facturación" : origen === "D" ? "Contabilidad" : "sistema externo");
  const letra = origen || "?";

  console.log(`[finiquito] Mensaje recibido exitosamente del sistema de ${modulo} (grupo ${letra})`);

  let atributos = {
    id_mensaje: idMensaje,
    origen: letra,
    origen_modulo: modulo,
    tipo: tipoEvento ?? "mensaje",
  };
  try {
    if (cuerpo?.encabezado?.origen?.grupo && cuerpo?.encabezado?.destino?.grupo) {
      atributos = atributosDe(cuerpo);
    }
  } catch {
    // Mantiene los atributos parciales si el encabezado está incompleto.
  }

  mensajesPublicados.registrar({
    direccion: "recibido",
    topico,
    idPubSub: idPubSub || `simulado-${idMensaje.slice(0, 12)}`,
    atributos,
    cuerpo: cuerpo ?? {},
  });
}

async function notificarPrestamosSinSaldar({ proceso, finiquito, pendientes }) {
  if (!pendientes?.length || !finiquito.aprobado_por) return false;
  return notificaciones.enviarAvisoPrioritario({
    idRemitente: notificaciones.USUARIO_SISTEMA,
    idDestinatario: finiquito.aprobado_por,
    asunto: `Finiquito ${finiquito.numero_documento} pagado: préstamos sin saldar de ${proceso.nombre_empleado}`,
    contenido: construirContenidoAvisoPrestamos(proceso, finiquito, pendientes),
    enlace: `/desvinculacion/finiquitos/${proceso.id_proceso}`,
  });
}

// AC4: aplica una confirmación o rechazo de Pagos/Contabilidad en una transacción todo o nada.
async function aplicar(idEntrante) {
  let resultadoTx;
  try {
    resultadoTx = await enTransaccion(async (cliente) => {
      const fila = await modelo.bloquearMensajeEntrante(cliente, idEntrante);
      if (!fila || fila.estado !== "RECIBIDO") return { ok: true, omitido: true };

      const lectura = leerConfirmacionFiniquito(fila.carga);
      if (lectura.errores) throw new Error(lectura.errores.join(" "));

      const { destino, idFiniquito, idMensajeOrigen, resultado, referencia, motivo } = lectura.confirmacion;
      const finiquito = await modelo.bloquearFiniquitoPorId(cliente, idFiniquito);
      if (!finiquito) throw new Error("El finiquito indicado no existe.");
      if (finiquito.estado === "BORRADOR") throw new Error("El finiquito aún está en borrador.");

      const envios = await modelo.ultimosEnviosPorDestino(idFiniquito, cliente);
      const ultimoEnvio = envios[destino];
      if (!ultimoEnvio || ultimoEnvio.id_mensaje !== idMensajeOrigen) {
        await modelo.marcarMensajeEntranteIgnorado(
          cliente,
          idEntrante,
          idFiniquito,
          destino,
          "Respuesta a un envío anterior o desconocido."
        );
        return { ok: true, ignorado: true };
      }

      const estadoDestinoActual = destino === "PAGOS" ? finiquito.estado_pagos : finiquito.estado_contabilidad;
      if (estadoDestinoActual === "CONFIRMADA") {
        await modelo.marcarMensajeEntranteIgnorado(
          cliente,
          idEntrante,
          idFiniquito,
          destino,
          "La integración ya estaba confirmada."
        );
        return { ok: true, ignorado: true };
      }

      const estados = await modelo.actualizarRespuestaIntegracion(cliente, idFiniquito, {
        destino,
        resultado,
        referencia,
        motivo,
      });
      await modelo.marcarMensajeEntranteProcesado(cliente, idEntrante, idFiniquito, destino);

      let avisoPendiente = null;
      if (
        finiquito.estado === "APROBADO" &&
        estados.estado_pagos === "CONFIRMADA" &&
        estados.estado_contabilidad === "CONFIRMADA"
      ) {
        await modelo.marcarFiniquitoPagadoYCerrarProceso(cliente, idFiniquito, finiquito.id_proceso);

        const prestamos = await modelo.listarPrestamosEmpleado(finiquito.id_empleado, cliente, { bloquear: true });
        const descuentos = (finiquito.renglones ?? []).filter((r) => r.tipo === "DESCUENTO");
        const { saldados, pendientes } = clasificarPrestamosAlPagar(descuentos, prestamos);
        for (const s of saldados) {
          await modelo.saldarPrestamo(cliente, s.id_prestamo);
        }
        if (pendientes.length > 0) {
          avisoPendiente = {
            proceso: { id_proceso: finiquito.id_proceso, nombre_empleado: finiquito.nombre_empleado },
            finiquito,
            pendientes,
          };
        }
      }

      return { ok: true, destino, resultado, idFiniquito, avisoPendiente };
    });
  } catch (error) {
    return { ok: false, error: error.message };
  }

  if (resultadoTx?.avisoPendiente) {
    await notificarPrestamosSinSaldar(resultadoTx.avisoPendiente).catch((err) => {
      console.error("[finiquito] Error al enviar aviso de préstamos sin saldar:", err.message);
    });
  }
  return resultadoTx;
}

async function entregar(idEntrante) {
  if (enVuelo.has(idEntrante)) return { estado: "RECIBIDO", enCurso: true };
  enVuelo.add(idEntrante);
  try {
    const maxIntentos = finiquitoMaximoIntentos();
    for (;;) {
      const res = await aplicar(idEntrante);
      if (res.ok) {
        return { estado: res.ignorado ? "IGNORADO" : "PROCESADO" };
      }

      const intentos = await modelo.registrarFalloMensajeEntrante(idEntrante, res.error);
      if (intentos === null) {
        return { estado: (await modelo.obtenerMensajeEntrante(idEntrante))?.estado };
      }
      if (intentos >= maxIntentos) {
        await modelo.enviarMensajeEntranteADlq(idEntrante);
        console.error(
          `[finiquito] Mensaje entrante ${idEntrante} enviado a la cola de errores (DLQ) tras ${intentos} intento(s): ${res.error}`
        );
        return { estado: "EN_DLQ", error: res.error };
      }
      console.error(`[finiquito] Error al procesar mensaje entrante ${idEntrante} (intento ${intentos}): ${res.error}`);
      await esperar(esperaReentregaFiniquito(intentos));
    }
  } finally {
    enVuelo.delete(idEntrante);
  }
}

async function recibirMensaje(texto, { topico = topicoPropio(), idPubSub = null } = {}) {
  const info = identificarMensajeFiniquito(texto);
  mostrarEnConsola(info, topico, idPubSub);

  const { fila, duplicado } = await modelo.registrarMensajeEntrante({
    idMensaje: info.idMensaje,
    origen: info.origen,
    tipoEvento: info.tipoEvento,
    idFiniquito: info.idFiniquito,
    destino: info.destino,
    carga: String(texto ?? ""),
  });

  if (duplicado) {
    console.log(`[finiquito] Mensaje ${info.idMensaje} repetido: ya estaba ${fila.estado}; se descarta.`);
    return {
      id_entrante: fila.id_entrante,
      id_mensaje: fila.id_mensaje,
      estado: fila.estado,
      duplicado: true,
      terminado: Promise.resolve({ estado: fila.estado }),
    };
  }

  const terminado = entregar(fila.id_entrante);
  terminado.catch((error) => {
    console.error(`[finiquito] Falló el procesamiento del mensaje ${fila.id_entrante}:`, error.message);
  });

  return {
    id_entrante: fila.id_entrante,
    id_mensaje: fila.id_mensaje,
    estado: fila.estado,
    duplicado: false,
    terminado,
  };
}

async function reanudarRecibidos() {
  try {
    const pendientes = await modelo.listarRecibidosAntiguos(SEGUNDOS_REANUDAR);
    for (const { id_entrante: idEntrante } of pendientes) {
      if (enVuelo.has(idEntrante)) continue;
      entregar(idEntrante).catch((error) => {
        console.error(`[finiquito] Error al reanudar mensaje ${idEntrante}:`, error.message);
      });
    }
  } catch (error) {
    console.error("[finiquito] No se pudieron reanudar los mensajes entrantes:", error.message);
  }
}

async function listarMensajesProceso(idProceso, identidad) {
  validarConsulta(identidad);
  if (!UUID_RE.test(idProceso ?? "")) {
    throw new ErrorApp(404, "Proceso de desvinculación no encontrado.");
  }
  const finiquito = await modelo.obtenerPorProceso(idProceso.toLowerCase());
  if (!finiquito) return [];
  return modelo.listarMensajesEntrantes({ idFiniquito: finiquito.id_finiquito, limite: LIMITE_LISTADO });
}

async function listarMensajesEntrantes({ estado } = {}, identidad) {
  validarAdmin(identidad);
  const estadoNormalizado = validarFiltroEstadoEntrante(estado);
  return modelo.listarMensajesEntrantes({ estado: estadoNormalizado, limite: LIMITE_LISTADO });
}

async function reprocesarMensaje(idEntrante, identidad) {
  validarAdmin(identidad);
  const id = typeof idEntrante === "string" ? idEntrante.trim().toLowerCase() : "";
  const fila = UUID_RE.test(id) ? await modelo.obtenerMensajeEntrante(id) : null;
  if (!fila) throw new ErrorApp(404, "Mensaje entrante no encontrado.");

  if (fila.estado !== "EN_DLQ" || !(await modelo.reabrirMensajeEntrante(id))) {
    throw new ErrorApp(409, "Solo se reprocesan mensajes que están en la cola de errores (EN_DLQ).", [
      { campo: "estado", mensaje: `El mensaje está ${fila.estado}.` },
    ]);
  }

  const resultado = await aplicar(id);
  if (!resultado.ok) {
    await modelo.registrarFalloMensajeEntrante(id, resultado.error);
    await modelo.enviarMensajeEntranteADlq(id);
    throw new ErrorApp(422, `No se pudo reprocesar el mensaje: ${resultado.error}`);
  }
  return modelo.obtenerMensajeEntrante(id);
}

// Simula la llegada de cualquier mensaje (duplicado, inválido, etc.) publicándolo primero en el tópico F.
async function simularLlegada(datos, identidad) {
  validarAdmin(identidad);
  if (!simulacionFiniquitoActiva()) {
    throw new ErrorApp(403, "La simulación de respuestas de finiquito está desactivada.");
  }

  const mensaje = datos?.mensaje;
  if (mensaje === undefined || mensaje === null || (typeof mensaje === "string" && mensaje.trim() === "")) {
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "mensaje", mensaje: "Envíe el mensaje (objeto JSON o texto)." },
    ]);
  }

  const clientePubSub = pubsub.obtenerCliente();
  if (!clientePubSub) {
    throw new ErrorApp(503, "Pub/Sub no está configurado para publicar el mensaje simulado.");
  }

  const texto = typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje);
  const topico = topicoPropio();
  let atributos = {};
  try {
    const parsed = JSON.parse(texto);
    if (parsed?.encabezado?.origen?.grupo && parsed?.encabezado?.destino?.grupo) {
      atributos = atributosDe(parsed);
    }
  } catch {
    // Un JSON inválido se publica igual sin atributos de sobre.
  }

  const idPubSub = await clientePubSub.topic(topico).publishMessage({
    data: Buffer.from(texto),
    attributes: atributos,
  });

  const { terminado, ...resumen } = await recibirMensaje(texto, { topico, idPubSub });
  return { ...resumen, id_pubsub: idPubSub, topico };
}

module.exports = {
  recibirMensaje,
  aplicar,
  entregar,
  reanudarRecibidos,
  listarMensajesProceso,
  listarMensajesEntrantes,
  reprocesarMensaje,
  simularLlegada,
};
