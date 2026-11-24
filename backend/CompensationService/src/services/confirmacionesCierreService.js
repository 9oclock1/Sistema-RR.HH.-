const { randomUUID } = require("node:crypto");
const modelo = require("../models/cierresModel");
const notificaciones = require("../clients/notificacionesCliente");
const { topicoPropio } = require("./eventos.service");
const { enTransaccion } = require("../config/transaccion");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { atributosDe } = require("../utils/integraciones");
const mensajesPublicados = require("../utils/mensajesPublicados");
const { validarAdmin, validarConsulta } = require("../utils/desvinculaciones");
const {
  DESTINOS_CIERRE,
  GRUPOS_DESTINO_CIERRE,
  cierreMaximoIntentos,
  esperaReentregaCierre,
  revocacionPlazoSegundos,
  revocacionMaximoReenvios,
  resumirEstadoCierre,
  armarMensajeDesvinculado,
  identificarMensajeCierre,
  leerConfirmacionCierre,
  construirAvisoVencimientoReenvio,
  construirAvisoVencimientoAgotado,
  construirAvisoRechazoRevocacion,
} = require("../utils/cierres");

const LIMITE_LISTADO = 100;
const SEGUNDOS_REANUDAR = 30;
const INTERVALO_VIGILANTE_MS = 5000;
const REMITENTE_CIERRES = "Sistema de RRHH (cierres)";
const enVuelo = new Set();

const esperar = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

function mostrarEnConsola({ cuerpo, idMensaje, origen, tipoEvento }, topico, idPubSub) {
  const destinoClave = origen && GRUPOS_DESTINO_CIERRE[origen];
  const modulo =
    cuerpo?.encabezado?.origen?.modulo ||
    (destinoClave ? DESTINOS_CIERRE[destinoClave].modulo : "sistema externo");
  const letra = origen || "?";

  console.log(`[cierre] Mensaje recibido exitosamente del sistema de ${modulo} (grupo ${letra})`);

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
    // Mantiene atributos parciales si el encabezado está incompleto.
  }

  mensajesPublicados.registrar({
    direccion: "recibido",
    topico,
    idPubSub: idPubSub || `simulado-${idMensaje.slice(0, 12)}`,
    atributos,
    cuerpo: cuerpo ?? {},
  });
}

async function enviarAvisoCierre({ idDestinatario, idProceso, asunto, contenido }) {
  if (!idDestinatario) return false;
  return notificaciones.enviarAvisoPrioritario({
    idRemitente: notificaciones.USUARIO_SISTEMA,
    remitenteNombre: REMITENTE_CIERRES,
    idDestinatario,
    asunto,
    contenido,
    enlace: `/desvinculacion/cierre/${idProceso}`,
  });
}

// AC3: aplica una confirmación o rechazo de revocación de accesos en una transacción todo o nada.
async function aplicar(idEntrante) {
  let resultadoTx;
  try {
    resultadoTx = await enTransaccion(async (cliente) => {
      const fila = await modelo.bloquearMensajeEntrante(cliente, idEntrante);
      if (!fila || fila.estado !== "RECIBIDO") return { ok: true, omitido: true };

      const lectura = leerConfirmacionCierre(fila.carga);
      if (lectura.errores) throw new Error(lectura.errores.join(" "));

      const {
        destino,
        idCierre,
        idMensajeOrigen,
        resultado,
        recursosRevocados,
        referencia,
        motivo,
      } = lectura.confirmacion;

      const cierre = await modelo.bloquearCierrePorId(cliente, idCierre);
      if (!cierre) throw new Error("El cierre de desvinculación indicado no existe.");

      const revocaciones = await modelo.bloquearRevocacionesCierre(cliente, idCierre);
      const revocacion = revocaciones.find((r) => r.destino === destino);
      if (!revocacion) throw new Error(`No existe registro de revocación para ${destino}.`);

      const envios = await modelo.listarEnviosSalientesDestino(idCierre, destino, cliente);
      const ultimoEnvio = envios[0] || null;
      const perteneceAAlgunEnvio = envios.some((e) => e.id_mensaje === idMensajeOrigen);

      if (resultado === "CONFIRMADA") {
        if (!perteneceAAlgunEnvio) {
          await modelo.marcarMensajeEntranteIgnorado(
            cliente,
            idEntrante,
            idCierre,
            destino,
            "Respuesta a un envío desconocido."
          );
          return { ok: true, ignorado: true };
        }
        if (revocacion.estado === "CONFIRMADA") {
          await modelo.marcarMensajeEntranteIgnorado(
            cliente,
            idEntrante,
            idCierre,
            destino,
            "La revocación en este sistema ya estaba confirmada."
          );
          return { ok: true, ignorado: true };
        }

        await modelo.actualizarRevocacionConfirmada(cliente, idCierre, destino, {
          recursosRevocados,
          referencia,
        });
      } else {
        if (!ultimoEnvio || ultimoEnvio.id_mensaje !== idMensajeOrigen) {
          await modelo.marcarMensajeEntranteIgnorado(
            cliente,
            idEntrante,
            idCierre,
            destino,
            "Rechazo correspondiente a un envío anterior o desconocido."
          );
          return { ok: true, ignorado: true };
        }
        if (revocacion.estado === "CONFIRMADA") {
          await modelo.marcarMensajeEntranteIgnorado(
            cliente,
            idEntrante,
            idCierre,
            destino,
            "La revocación en este sistema ya estaba confirmada."
          );
          return { ok: true, ignorado: true };
        }

        await modelo.actualizarRevocacionRechazada(cliente, idCierre, destino, { motivo });
      }

      await modelo.marcarMensajeEntranteProcesado(cliente, idEntrante, idCierre, destino);

      const actualizadas = revocaciones.map((r) => (r.destino === destino ? { ...r, estado: resultado } : r));
      const nuevoEstadoCierre = resumirEstadoCierre(actualizadas);
      await modelo.actualizarEstadoCierre(cliente, idCierre, nuevoEstadoCierre);

      const avisoRechazo =
        resultado === "RECHAZADA"
          ? {
              idDestinatario: cierre.cerrado_por,
              idProceso: cierre.id_proceso,
              ...construirAvisoRechazoRevocacion({
                nombreEmpleado: cierre.nombre_empleado,
                modulo: DESTINOS_CIERRE[destino].modulo,
                grupo: DESTINOS_CIERRE[destino].grupo,
                motivo,
              }),
            }
          : null;

      return { ok: true, destino, resultado, idCierre, avisoRechazo };
    });
  } catch (error) {
    return { ok: false, error: error.message };
  }

  if (resultadoTx?.avisoRechazo) {
    await enviarAvisoCierre(resultadoTx.avisoRechazo).catch((err) => {
      console.error("[cierre] Error al enviar aviso de rechazo:", err.message);
    });
  }
  return resultadoTx;
}

async function entregar(idEntrante) {
  if (enVuelo.has(idEntrante)) return { estado: "RECIBIDO", enCurso: true };
  enVuelo.add(idEntrante);
  try {
    const maxIntentos = cierreMaximoIntentos();
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
          `[cierre] Mensaje entrante ${idEntrante} enviado a la cola de errores (DLQ) tras ${intentos} intento(s): ${res.error}`
        );
        return { estado: "EN_DLQ", error: res.error };
      }
      console.error(`[cierre] Error al procesar mensaje entrante ${idEntrante} (intento ${intentos}): ${res.error}`);
      await esperar(esperaReentregaCierre(intentos));
    }
  } finally {
    enVuelo.delete(idEntrante);
  }
}

async function recibirMensaje(texto, { topico = topicoPropio(), idPubSub = null } = {}) {
  const info = identificarMensajeCierre(texto);
  mostrarEnConsola(info, topico, idPubSub);

  const { fila, duplicado } = await modelo.registrarMensajeEntrante({
    idMensaje: info.idMensaje,
    origen: info.origen,
    tipoEvento: info.tipoEvento,
    idCierre: info.idCierre,
    destino: info.destino,
    carga: String(texto ?? ""),
  });

  if (duplicado) {
    console.log(`[cierre] Mensaje ${info.idMensaje} repetido: ya estaba ${fila.estado}; se descarta.`);
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
    console.error(`[cierre] Falló el procesamiento del mensaje ${fila.id_entrante}:`, error.message);
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
        console.error(`[cierre] Error al reanudar mensaje ${idEntrante}:`, error.message);
      });
    }
  } catch (error) {
    console.error("[cierre] No se pudieron reanudar los mensajes entrantes:", error.message);
  }
}

async function listarMensajesProceso(idProceso, identidad) {
  validarConsulta(identidad);
  if (!UUID_RE.test(idProceso ?? "")) {
    throw new ErrorApp(404, "Proceso de desvinculación no encontrado.");
  }
  const cierre = await modelo.obtenerCierrePorProceso(idProceso.toLowerCase());
  if (!cierre) return [];
  return modelo.listarMensajesEntrantes({ idCierre: cierre.id_cierre, limite: LIMITE_LISTADO });
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

// AC4: revisa revocaciones ENVIADA cuyo plazo venció; reintenta hasta el máximo configurado y alerta al admin.
async function revisarPlazosVencidos() {
  const maxReenvios = revocacionMaximoReenvios();
  const plazoSegundos = revocacionPlazoSegundos();
  const topico = topicoPropio();

  const avisos = await enTransaccion(async (cliente) => {
    const vencidas = await modelo.reservarRevocacionesVencidas(cliente, 10);
    if (vencidas.length === 0) return [];

    const pendientesAviso = [];
    for (const rev of vencidas) {
      const cfg = DESTINOS_CIERRE[rev.destino];
      const reenviosActuales = Number(rev.reenvios_por_plazo);

      if (reenviosActuales < maxReenvios) {
        const enviosPrevios = await modelo.ultimosEnviosPorDestino(rev.id_cierre, cliente);
        const empleadoPrevio = enviosPrevios[rev.destino]?.carga?.datos?.empleado ?? {
          id_empleado: rev.id_empleado,
          codigo_empleado: rev.id_empleado,
          nombre_completo: rev.nombre_empleado,
          cargo: null,
          sucursal: null,
        };

        await modelo.marcarRevocacionReenvioPorPlazo(cliente, rev.id_revocacion);

        const idMensaje = randomUUID();
        const carga = armarMensajeDesvinculado({
          idMensaje,
          destino: rev.destino,
          idCierre: rev.id_cierre,
          empleado: empleadoPrevio,
          fechaRetiro: rev.fecha_retiro,
          causal: rev.codigo_causal,
          cerradoEn: rev.cerrado_en,
        });
        await modelo.registrarEvento(cliente, {
          idMensaje,
          idCierre: rev.id_cierre,
          sentido: "SALIENTE",
          destino: rev.destino,
          tipoEvento: carga.encabezado.tipo,
          topico,
          carga,
        });

        pendientesAviso.push({
          idDestinatario: rev.cerrado_por,
          idProceso: rev.id_proceso,
          ...construirAvisoVencimientoReenvio({
            nombreEmpleado: rev.nombre_empleado,
            modulo: cfg.modulo,
            grupo: cfg.grupo,
            plazoSegundos,
            numeroReenvio: reenviosActuales + 1,
            maxReenvios,
          }),
        });
      } else {
        await modelo.marcarRevocacionVencida(
          cliente,
          rev.id_revocacion,
          `Sin confirmación tras ${maxReenvios} reenvíos.`
        );
        const todas = await modelo.bloquearRevocacionesCierre(cliente, rev.id_cierre);
        const actualizadas = todas.map((r) => (r.destino === rev.destino ? { ...r, estado: "VENCIDA" } : r));
        await modelo.actualizarEstadoCierre(cliente, rev.id_cierre, resumirEstadoCierre(actualizadas));

        pendientesAviso.push({
          idDestinatario: rev.cerrado_por,
          idProceso: rev.id_proceso,
          ...construirAvisoVencimientoAgotado({
            nombreEmpleado: rev.nombre_empleado,
            modulo: cfg.modulo,
            maxReenvios,
          }),
        });
      }
    }
    return pendientesAviso;
  });

  for (const aviso of avisos) {
    await enviarAvisoCierre(aviso).catch((err) => {
      console.error("[cierre] Error al enviar aviso de vencimiento:", err.message);
    });
  }

  return avisos.length;
}

function iniciarVigilantePlazos() {
  let ocupado = false;
  setInterval(async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await revisarPlazosVencidos();
    } catch (error) {
      console.error("[cierre] Error en el vigilante de plazos:", error.message);
    } finally {
      ocupado = false;
    }
  }, INTERVALO_VIGILANTE_MS).unref();
}

module.exports = {
  recibirMensaje,
  aplicar,
  entregar,
  reanudarRecibidos,
  listarMensajesProceso,
  reprocesarMensaje,
  revisarPlazosVencidos,
  iniciarVigilantePlazos,
};
