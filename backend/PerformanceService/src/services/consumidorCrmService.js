const modelo = require("../models/mensajesEntrantesModel");
const desempeno = require("../models/desempenoModel");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { ESTADO_CICLO } = require("../utils/evaluaciones");
const { atributosDe } = require("../utils/mensajeria");
const mensajesPublicados = require("../utils/mensajesPublicados");
const {
  ESTADO_MENSAJE,
  CODIGO_ESTADO_MENSAJE,
  simulacionActiva,
  demoraRespuestaMs,
  topicoCrm,
  maximoIntentos,
  esperaReentrega,
  identificarMensaje,
  leerMensajeCrm,
  armarRespuestaCrm,
} = require("../utils/metricasCrm");

const SEGUNDOS_PARA_REANUDAR = 30;
const LIMITE_LISTADO = 100;

// Mensajes que se están entregando en este momento en este proceso (no se vuelven a tomar mientras tanto).
const enVuelo = new Set();

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

class MensajeInvalido extends Error {}

// Un intento de aplicar el mensaje: todo o nada, dentro de una transacción. Devuelve { ok } o { ok: false, error }.
async function aplicar(idMensaje) {
  try {
    return await enTransaccion(async (db) => {
      const fila = await modelo.bloquear(idMensaje, db);
      if (!fila || fila.id_estado_mensaje !== ESTADO_MENSAJE.RECIBIDO)
        return { ok: true, omitido: true };

      const lectura = leerMensajeCrm(fila.carga);
      if (lectura.errores) throw new MensajeInvalido(lectura.errores.join(" "));
      const { idCiclo, periodo, metricas } = lectura.mensaje;

      const ciclo = await desempeno.obtenerCiclo(idCiclo, db);
      if (!ciclo) throw new MensajeInvalido("El ciclo indicado no existe.");
      if (ciclo.id_estado_ciclo !== ESTADO_CICLO.CERRADO)
        throw new MensajeInvalido("El ciclo indicado aún no está cerrado.");
      if (periodo !== null && periodo !== ciclo.periodo) {
        throw new MensajeInvalido(
          `El periodo «${periodo}» no corresponde al del ciclo («${ciclo.periodo}»).`,
        );
      }

      const evaluados = new Set(
        await modelo.listarEvaluadosDelCiclo(idCiclo, db),
      );
      const ajenos = metricas.filter(
        (metrica) => !evaluados.has(metrica.idEmpleado),
      );
      if (ajenos.length > 0) {
        throw new MensajeInvalido(
          `${ajenos.length} colaborador(es) no fueron evaluados en el ciclo: ${ajenos.map((m) => m.idEmpleado).join(", ")}.`,
        );
      }

      await modelo.guardarMetricas(idCiclo, idMensaje, metricas, db);
      await modelo.marcarProcesado(idMensaje, db);
      return { ok: true, metricas: metricas.length, ciclo: ciclo.nombre };
    });
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

// Entrega el mensaje hasta que se procese o se agoten los intentos (`CRM_MAXIMO_INTENTOS`), esperando más entre uno y
// otro. Al agotarlos queda EN_DLQ con el último error, para revisión: el consolidado sigue funcionando sin esas métricas.
async function entregar(idMensaje) {
  if (enVuelo.has(idMensaje))
    return {
      estado: CODIGO_ESTADO_MENSAJE[ESTADO_MENSAJE.RECIBIDO],
      enCurso: true,
    };
  enVuelo.add(idMensaje);
  try {
    for (;;) {
      const resultado = await aplicar(idMensaje);
      if (resultado.ok) {
        if (!resultado.omitido) {
          console.log(
            `[crm] Métricas del CRM aplicadas (${resultado.metricas} colaborador(es), ciclo «${resultado.ciclo}»).`,
          );
        }
        return { estado: CODIGO_ESTADO_MENSAJE[ESTADO_MENSAJE.PROCESADO] };
      }

      const fallos = await modelo.registrarFallo(idMensaje, resultado.error);
      if (fallos === null)
        return { estado: (await modelo.obtener(idMensaje))?.estado };
      if (fallos >= maximoIntentos()) {
        await modelo.enviarADlq(idMensaje);
        console.error(
          `[crm] Mensaje ${idMensaje} enviado a la cola de errores tras ${fallos} intento(s): ${resultado.error}`,
        );
        return {
          estado: CODIGO_ESTADO_MENSAJE[ESTADO_MENSAJE.EN_DLQ],
          error: resultado.error,
        };
      }
      console.error(
        `[crm] No se pudo procesar el mensaje ${idMensaje} (intento ${fallos}): ${resultado.error}`,
      );
      await esperar(esperaReentrega(fallos));
    }
  } finally {
    enVuelo.delete(idMensaje);
  }
}

// Lo que llegó, tal cual, para la consola del navegador (marcado como recibido).
function mostrarEnConsola(cuerpo, texto, idExterno) {
  let atributos = {};
  try {
    atributos = atributosDe(cuerpo);
  } catch {
    // Un mensaje sin encabezado completo igual se muestra, solo que sin atributos.
  }
  mensajesPublicados.registrar({
    direccion: "recibido",
    topico: topicoCrm(),
    idPubSub: `simulado-${idExterno.slice(0, 12)}`,
    atributos,
    cuerpo: cuerpo ?? texto,
  });
}

// Entrada de todo mensaje del CRM. Responde enseguida con su id y estado (como el ack de una suscripción) y sigue
// procesando en segundo plano; `terminado` se resuelve cuando ya quedó PROCESADO o EN_DLQ.
async function recibirMensaje(texto) {
  const { cuerpo, idExterno, tipoEvento } = identificarMensaje(texto);
  mostrarEnConsola(cuerpo, texto, idExterno);

  const { fila, duplicado } = await modelo.registrar({
    idExterno,
    tipoEvento,
    carga: texto,
  });
  if (duplicado) {
    console.log(
      `[crm] Mensaje ${idExterno} repetido: ya estaba ${fila.estado}; se descarta.`,
    );
    return {
      id_mensaje: fila.id_mensaje,
      estado: fila.estado,
      duplicado: true,
      terminado: Promise.resolve({ estado: fila.estado }),
    };
  }

  const terminado = entregar(fila.id_mensaje);
  terminado.catch((error) =>
    console.error(
      `[crm] Falló la entrega del mensaje ${fila.id_mensaje}:`,
      error.message,
    ),
  );
  return {
    id_mensaje: fila.id_mensaje,
    estado: fila.estado,
    duplicado: false,
    terminado,
  };
}

// La respuesta del CRM a una solicitud recién publicada, tras una pequeña demora para que se note que es asíncrona.
async function simularRespuesta(solicitud) {
  await esperar(demoraRespuestaMs());
  return recibirMensaje(JSON.stringify(armarRespuestaCrm(solicitud)));
}

// Si el servicio se reinició a mitad de los reintentos, esos mensajes quedaron RECIBIDO: se retoman.
async function reanudarRecibidos() {
  try {
    for (const {
      id_mensaje: idMensaje,
    } of await modelo.listarRecibidosAntiguos(SEGUNDOS_PARA_REANUDAR)) {
      if (enVuelo.has(idMensaje)) continue;
      entregar(idMensaje).catch((error) =>
        console.error(
          `[crm] Falló la entrega del mensaje ${idMensaje}:`,
          error.message,
        ),
      );
    }
  } catch (error) {
    console.error(
      "[crm] No se pudieron retomar los mensajes pendientes:",
      error.message,
    );
  }
}

const describirMensaje = (fila) => ({
  id_mensaje: fila.id_mensaje,
  id_mensaje_externo: fila.id_mensaje_externo,
  tipo_evento: fila.tipo_evento,
  estado: fila.estado,
  intentos: fila.intentos,
  ultimo_error: fila.ultimo_error,
  recibido_en: fila.recibido_en,
  procesado_en: fila.procesado_en,
  metricas: fila.metricas ?? 0,
  carga: fila.carga,
});

// Mensajes del CRM recibidos; con ?estado=EN_DLQ, la cola de errores pendiente de revisión.
async function listarMensajes({ estado } = {}) {
  let idEstado = null;
  if (estado !== undefined) {
    idEstado =
      Number(
        Object.keys(CODIGO_ESTADO_MENSAJE).find(
          (id) => CODIGO_ESTADO_MENSAJE[id] === estado,
        ),
      ) || null;
    if (idEstado === null) {
      throw new ErrorApp(400, "Filtros inválidos", [
        {
          campo: "estado",
          mensaje: `Use uno de: ${Object.values(CODIGO_ESTADO_MENSAJE).join(", ")}.`,
        },
      ]);
    }
  }
  return (await modelo.listar({ idEstado, limite: LIMITE_LISTADO })).map(
    describirMensaje,
  );
}

// Vuelve a procesar un mensaje de la cola de errores (por ejemplo, tras corregir el dato que faltaba). Es un solo
// intento: si falla otra vez, el mensaje vuelve a la cola con el motivo actualizado.
async function reprocesarMensaje(idPedido) {
  const id = typeof idPedido === "string" ? idPedido.trim().toLowerCase() : "";
  const fila = UUID_RE.test(id) ? await modelo.obtener(id) : null;
  if (!fila) throw new ErrorApp(404, "Mensaje no encontrado");
  if (
    fila.id_estado_mensaje !== ESTADO_MENSAJE.EN_DLQ ||
    !(await modelo.reabrir(id))
  ) {
    throw new ErrorApp(
      409,
      "Solo se reprocesan los mensajes que están en la cola de errores.",
      [{ campo: "estado", mensaje: `El mensaje está ${fila.estado}.` }],
    );
  }

  const resultado = await aplicar(id);
  if (!resultado.ok) {
    await modelo.registrarFallo(id, resultado.error);
    await modelo.enviarADlq(id);
    throw new ErrorApp(
      422,
      `No se pudo reprocesar el mensaje: ${resultado.error}`,
    );
  }
  return describirMensaje(await modelo.obtener(id));
}

// Simula la llegada de un mensaje del CRM (para probar duplicados, datos inválidos, etc.). Acepta el objeto del
// mensaje o su texto tal cual. Responde apenas lo registra; el resultado se ve en el listado.
async function simularLlegada(datos) {
  if (!simulacionActiva())
    throw new ErrorApp(
      403,
      "La simulación del CRM está desactivada (SIMULAR_CRM_ACTIVO=false).",
    );
  const mensaje = datos?.mensaje;
  if (
    mensaje === undefined ||
    mensaje === null ||
    (typeof mensaje === "string" && mensaje.trim() === "")
  ) {
    throw new ErrorApp(400, "Datos inválidos", [
      {
        campo: "mensaje",
        mensaje: "Envíe el mensaje del CRM (objeto JSON o texto).",
      },
    ]);
  }
  const texto = typeof mensaje === "string" ? mensaje : JSON.stringify(mensaje);
  const { terminado, ...recibido } = await recibirMensaje(texto);
  return recibido;
}

module.exports = {
  recibirMensaje,
  simularRespuesta,
  reanudarRecibidos,
  listarMensajes,
  reprocesarMensaje,
  simularLlegada,
};
