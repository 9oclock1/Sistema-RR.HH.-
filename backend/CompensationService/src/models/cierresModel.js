const pool = require("../config/db");

async function listarProcesosParaCierre({ estado = null } = {}, db = pool) {
  const condiciones = ["p.estado <> 'ANULADO'", "f.estado IN ('APROBADO', 'PAGADO')"];
  const params = [];

  if (estado === "PENDIENTE_CIERRE") {
    condiciones.push("ci.id_cierre IS NULL");
  } else if (estado) {
    params.push(estado);
    condiciones.push(`ci.estado_revocaciones = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT p.id_proceso,
            p.id_empleado,
            p.nombre_empleado,
            to_char(p.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
            to_char(p.fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro,
            p.codigo_causal,
            c.nombre AS causal_nombre,
            p.estado AS estado_proceso,
            p.creado_en,
            f.id_finiquito,
            f.numero_documento,
            f.estado AS finiquito_estado,
            f.liquido_pagable,
            ci.id_cierre,
            ci.estado_revocaciones,
            ci.cuenta_estado,
            ci.cerrado_en,
            ci.completado_en
       FROM PROCESOS_DESVINCULACION p
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
       JOIN FINIQUITOS f ON f.id_proceso = p.id_proceso
       LEFT JOIN CIERRES_DESVINCULACION ci ON ci.id_proceso = p.id_proceso
      WHERE ${condiciones.join(" AND ")}
      ORDER BY p.creado_en DESC`,
    params
  );

  return rows.map((r) => ({
    id_proceso: r.id_proceso,
    id_empleado: r.id_empleado,
    nombre_empleado: r.nombre_empleado,
    fecha_ingreso: r.fecha_ingreso,
    fecha_retiro: r.fecha_retiro,
    causal: { codigo: r.codigo_causal, nombre: r.causal_nombre },
    estado: r.estado_proceso,
    creado_en: r.creado_en,
    finiquito: {
      id_finiquito: r.id_finiquito,
      numero_documento: r.numero_documento,
      estado: r.finiquito_estado,
      liquido_pagable: Number(r.liquido_pagable),
    },
    cierre: r.id_cierre
      ? {
          id_cierre: r.id_cierre,
          estado_revocaciones: r.estado_revocaciones,
          cuenta_estado: r.cuenta_estado,
          cerrado_en: r.cerrado_en,
          completado_en: r.completado_en,
        }
      : null,
  }));
}

async function obtenerProcesoParaCierre(idProceso, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT p.id_proceso,
            p.id_empleado,
            p.nombre_empleado,
            to_char(p.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
            p.codigo_causal,
            c.nombre AS causal_nombre,
            to_char(p.fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro,
            p.corresponde_desahucio,
            p.estado,
            p.observaciones
       FROM PROCESOS_DESVINCULACION p
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
      WHERE p.id_proceso = $1${bloquear ? " FOR UPDATE OF p" : ""}`,
    [idProceso]
  );
  return rows[0] || null;
}

async function obtenerFiniquitoDeProceso(idProceso, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT id_finiquito, id_proceso, numero_documento, estado, liquido_pagable, aprobado_en, pagado_en
       FROM FINIQUITOS
      WHERE id_proceso = $1${bloquear ? " FOR UPDATE" : ""}`,
    [idProceso]
  );
  return rows[0] || null;
}

async function obtenerCierrePorProceso(idProceso, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT id_cierre, id_proceso, id_finiquito, id_empleado, estado_finiquito_al_cerrar,
            empleado_inactivado_en, cuenta_estado, cuenta_revocada_en, estado_revocaciones,
            cerrado_por, cerrado_por_rol, cerrado_en, completado_en
       FROM CIERRES_DESVINCULACION
      WHERE id_proceso = $1${bloquear ? " FOR UPDATE" : ""}`,
    [idProceso]
  );
  return rows[0] || null;
}

async function crearCierre(cliente, datos) {
  const { rows } = await cliente.query(
    `INSERT INTO CIERRES_DESVINCULACION (
       id_proceso, id_finiquito, id_empleado, estado_finiquito_al_cerrar,
       empleado_inactivado_en, cuenta_estado, cuenta_revocada_en,
       estado_revocaciones, cerrado_por, cerrado_por_rol
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'EN_PROCESO', $8, $9)
     RETURNING id_cierre, id_proceso, id_finiquito, id_empleado, estado_finiquito_al_cerrar,
               empleado_inactivado_en, cuenta_estado, cuenta_revocada_en, estado_revocaciones,
               cerrado_por, cerrado_por_rol, cerrado_en, completado_en`,
    [
      datos.id_proceso,
      datos.id_finiquito,
      datos.id_empleado,
      datos.estado_finiquito_al_cerrar,
      datos.empleado_inactivado_en,
      datos.cuenta_estado,
      datos.cuenta_revocada_en,
      datos.cerrado_por,
      datos.cerrado_por_rol,
    ]
  );
  return rows[0];
}

async function crearRevocacionesIniciales(cliente, idCierre, destinos) {
  for (const destino of destinos) {
    await cliente.query(
      `INSERT INTO REVOCACIONES_SISTEMA (id_cierre, destino, estado)
       VALUES ($1, $2, 'PENDIENTE')`,
      [idCierre, destino]
    );
  }
}

async function cerrarProcesoDesvinculacion(cliente, idProceso) {
  await cliente.query(
    `UPDATE PROCESOS_DESVINCULACION
        SET estado = 'CERRADO',
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_proceso = $1`,
    [idProceso]
  );
}

async function listarRevocacionesCierre(idCierre, db = pool) {
  const { rows } = await db.query(
    `SELECT id_revocacion, id_cierre, destino, estado, plazo_vence_en, reenvios_por_plazo,
            recursos_revocados, referencia, motivo, respondida_en, actualizado_en
       FROM REVOCACIONES_SISTEMA
      WHERE id_cierre = $1`,
    [idCierre]
  );
  return rows;
}

async function ultimosEnviosPorDestino(idCierre, db = pool) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (destino)
            id_evento, id_mensaje, destino, estado, intentos, ultimo_error,
            proximo_intento_en, entregado_en, creado_en, carga
       FROM EVENTOS_CIERRE
      WHERE id_cierre = $1
        AND sentido = 'SALIENTE'
      ORDER BY destino, creado_en DESC, id_evento DESC`,
    [idCierre]
  );
  return Object.fromEntries(rows.map((r) => [r.destino, r]));
}

async function registrarEvento(cliente, { idMensaje, idCierre, sentido, destino, tipoEvento, topico, carga, proximoIntentoEn = null }) {
  const { rows } = await cliente.query(
    `INSERT INTO EVENTOS_CIERRE (
       id_mensaje, id_cierre, sentido, destino, tipo_evento, topico, carga, proximo_intento_en
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, CURRENT_TIMESTAMP))
     RETURNING id_evento`,
    [idMensaje, idCierre, sentido, destino, tipoEvento, topico, carga, proximoIntentoEn]
  );
  return rows[0].id_evento;
}

async function reservarEventosPendientes(limite, segundosReserva, db = pool) {
  const { rows } = await db.query(
    `UPDATE EVENTOS_CIERRE
        SET proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $2)
      WHERE id_evento IN (
        SELECT id_evento
          FROM EVENTOS_CIERRE
         WHERE estado = 'PENDIENTE'
           AND proximo_intento_en <= CURRENT_TIMESTAMP
         ORDER BY creado_en ASC, id_evento ASC
         LIMIT $1
         FOR UPDATE SKIP LOCKED
      )
      RETURNING id_evento, id_mensaje, id_cierre, sentido, destino, tipo_evento, topico, carga, intentos`,
    [limite, segundosReserva]
  );
  return rows;
}

async function marcarEventoEntregado(idEvento, idPubSub, db = pool) {
  await db.query(
    `UPDATE EVENTOS_CIERRE
        SET estado = 'ENTREGADO',
            id_pubsub = left($2, 100),
            entregado_en = CURRENT_TIMESTAMP,
            intentos = intentos + 1,
            ultimo_error = NULL
      WHERE id_evento = $1
        AND estado = 'PENDIENTE'`,
    [idEvento, idPubSub ?? null]
  );
}

async function marcarEventoError(idEvento, { error, esperaMs, fallido }, db = pool) {
  await db.query(
    `UPDATE EVENTOS_CIERRE
        SET intentos = intentos + 1,
            ultimo_error = left($2, 255),
            proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3),
            estado = CASE WHEN $4 THEN 'FALLIDO' ELSE estado END
      WHERE id_evento = $1
        AND estado = 'PENDIENTE'`,
    [idEvento, error, esperaMs / 1000, Boolean(fallido)]
  );
}

async function marcarRevocacionEnviada(idCierre, destino, plazoSegundos, db = pool) {
  await db.query(
    `UPDATE REVOCACIONES_SISTEMA
        SET estado = 'ENVIADA',
            plazo_vence_en = CURRENT_TIMESTAMP + make_interval(secs => $3),
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_cierre = $1
        AND destino = $2
        AND estado = 'PENDIENTE'`,
    [idCierre, destino, plazoSegundos]
  );
}

async function bloquearRevocacionesCierre(cliente, idCierre) {
  const { rows } = await cliente.query(
    `SELECT id_revocacion, id_cierre, destino, estado, plazo_vence_en, reenvios_por_plazo,
            recursos_revocados, referencia, motivo, respondida_en, actualizado_en
       FROM REVOCACIONES_SISTEMA
      WHERE id_cierre = $1
      FOR UPDATE`,
    [idCierre]
  );
  return rows;
}

async function prepararReenvioRevocacion(cliente, idCierre, destino) {
  await cliente.query(
    `UPDATE REVOCACIONES_SISTEMA
        SET estado = 'PENDIENTE',
            plazo_vence_en = NULL,
            reenvios_por_plazo = 0,
            recursos_revocados = NULL,
            referencia = NULL,
            motivo = NULL,
            respondida_en = NULL,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_cierre = $1
        AND destino = $2`,
    [idCierre, destino]
  );
}

async function actualizarEstadoCierre(cliente, idCierre, estadoRevocaciones) {
  await cliente.query(
    `UPDATE CIERRES_DESVINCULACION
        SET estado_revocaciones = $2::varchar(20),
            completado_en = CASE WHEN $2::text = 'COMPLETADO' THEN COALESCE(completado_en, CURRENT_TIMESTAMP) ELSE NULL END
      WHERE id_cierre = $1`,
    [idCierre, estadoRevocaciones]
  );
}

async function obtenerUltimaRespuestaEntrante(idCierre, destino, db = pool) {
  const { rows } = await db.query(
    `SELECT id_entrante, id_mensaje, carga, estado, recibido_en
       FROM MENSAJES_CIERRE_ENTRANTES
      WHERE id_cierre = $1
        AND destino = $2
      ORDER BY recibido_en DESC, id_entrante DESC
      LIMIT 1`,
    [idCierre, destino]
  );
  return rows[0] || null;
}

async function bloquearCierrePorId(cliente, idCierre) {
  const { rows } = await cliente.query(
    `SELECT c.id_cierre, c.id_proceso, c.id_finiquito, c.id_empleado,
            c.estado_revocaciones, c.cerrado_por, c.cerrado_por_rol, c.cerrado_en, c.completado_en,
            p.nombre_empleado, to_char(p.fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro, p.codigo_causal
       FROM CIERRES_DESVINCULACION c
       JOIN PROCESOS_DESVINCULACION p ON p.id_proceso = c.id_proceso
      WHERE c.id_cierre = $1
      FOR UPDATE OF c`,
    [idCierre]
  );
  return rows[0] || null;
}

async function listarEnviosSalientesDestino(idCierre, destino, db = pool) {
  const { rows } = await db.query(
    `SELECT id_evento, id_mensaje, estado, creado_en, carga
       FROM EVENTOS_CIERRE
      WHERE id_cierre = $1
        AND destino = $2
        AND sentido = 'SALIENTE'
      ORDER BY creado_en DESC, id_evento DESC`,
    [idCierre, destino]
  );
  return rows;
}

async function actualizarRevocacionConfirmada(cliente, idCierre, destino, { recursosRevocados, referencia }) {
  await cliente.query(
    `UPDATE REVOCACIONES_SISTEMA
        SET estado = 'CONFIRMADA',
            recursos_revocados = $3::jsonb,
            referencia = $4,
            motivo = NULL,
            respondida_en = CURRENT_TIMESTAMP,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_cierre = $1
        AND destino = $2`,
    [idCierre, destino, JSON.stringify(recursosRevocados ?? []), referencia]
  );
}

async function actualizarRevocacionRechazada(cliente, idCierre, destino, { motivo }) {
  await cliente.query(
    `UPDATE REVOCACIONES_SISTEMA
        SET estado = 'RECHAZADA',
            recursos_revocados = NULL,
            referencia = NULL,
            motivo = left($3, 255),
            respondida_en = CURRENT_TIMESTAMP,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_cierre = $1
        AND destino = $2`,
    [idCierre, destino, motivo]
  );
}

async function registrarMensajeEntrante({ idMensaje, origen, tipoEvento, idCierre, destino, carga }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO MENSAJES_CIERRE_ENTRANTES (
       id_mensaje, origen, tipo_evento, id_cierre, destino, carga, estado
     )
     VALUES (
       $1, $2, $3,
       (SELECT id_cierre FROM CIERRES_DESVINCULACION WHERE id_cierre = $4),
       $5, $6, 'RECIBIDO'
     )
     ON CONFLICT (id_mensaje) DO NOTHING
     RETURNING id_entrante, id_mensaje, origen, tipo_evento, id_cierre, destino, carga, estado, intentos, ultimo_error, recibido_en, procesado_en`,
    [idMensaje, origen, tipoEvento, idCierre, destino, carga]
  );
  if (rows[0]) return { fila: rows[0], duplicado: false };

  const { rows: existentes } = await db.query(
    `SELECT id_entrante, id_mensaje, origen, tipo_evento, id_cierre, destino, carga, estado, intentos, ultimo_error, recibido_en, procesado_en
       FROM MENSAJES_CIERRE_ENTRANTES
      WHERE id_mensaje = $1`,
    [idMensaje]
  );
  return { fila: existentes[0], duplicado: true };
}

async function obtenerMensajeEntrante(idEntrante, db = pool) {
  const { rows } = await db.query(
    `SELECT id_entrante, id_mensaje, origen, tipo_evento, id_cierre, destino, carga, estado, intentos, ultimo_error, recibido_en, procesado_en
       FROM MENSAJES_CIERRE_ENTRANTES
      WHERE id_entrante = $1`,
    [idEntrante]
  );
  return rows[0] || null;
}

async function bloquearMensajeEntrante(cliente, idEntrante) {
  const { rows } = await cliente.query(
    `SELECT id_entrante, id_mensaje, origen, tipo_evento, id_cierre, destino, carga, estado, intentos
       FROM MENSAJES_CIERRE_ENTRANTES
      WHERE id_entrante = $1
      FOR UPDATE`,
    [idEntrante]
  );
  return rows[0] || null;
}

async function marcarMensajeEntranteProcesado(cliente, idEntrante, idCierre, destino) {
  await cliente.query(
    `UPDATE MENSAJES_CIERRE_ENTRANTES
        SET estado = 'PROCESADO',
            id_cierre = $2,
            destino = $3,
            procesado_en = CURRENT_TIMESTAMP,
            intentos = intentos + 1,
            ultimo_error = NULL
      WHERE id_entrante = $1
        AND estado = 'RECIBIDO'`,
    [idEntrante, idCierre, destino]
  );
}

async function marcarMensajeEntranteIgnorado(cliente, idEntrante, idCierre, destino, motivo) {
  await cliente.query(
    `UPDATE MENSAJES_CIERRE_ENTRANTES
        SET estado = 'IGNORADO',
            id_cierre = $2,
            destino = $3,
            procesado_en = CURRENT_TIMESTAMP,
            intentos = intentos + 1,
            ultimo_error = left($4, 255)
      WHERE id_entrante = $1
        AND estado = 'RECIBIDO'`,
    [idEntrante, idCierre, destino, motivo]
  );
}

async function registrarFalloMensajeEntrante(idEntrante, error, db = pool) {
  const { rows } = await db.query(
    `UPDATE MENSAJES_CIERRE_ENTRANTES
        SET intentos = intentos + 1,
            ultimo_error = left($2, 255)
      WHERE id_entrante = $1
        AND estado = 'RECIBIDO'
      RETURNING intentos`,
    [idEntrante, error]
  );
  return rows[0]?.intentos ?? null;
}

async function enviarMensajeEntranteADlq(idEntrante, db = pool) {
  await db.query(
    `UPDATE MENSAJES_CIERRE_ENTRANTES
        SET estado = 'EN_DLQ'
      WHERE id_entrante = $1
        AND estado = 'RECIBIDO'`,
    [idEntrante]
  );
}

async function reabrirMensajeEntrante(idEntrante, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE MENSAJES_CIERRE_ENTRANTES
        SET estado = 'RECIBIDO',
            intentos = 0,
            ultimo_error = NULL
      WHERE id_entrante = $1
        AND estado = 'EN_DLQ'`,
    [idEntrante]
  );
  return rowCount > 0;
}

async function listarMensajesEntrantes({ estado = null, idCierre = null, limite = 100 } = {}, db = pool) {
  const condiciones = [];
  const params = [];
  if (estado) {
    params.push(estado);
    condiciones.push(`m.estado = $${params.length}`);
  }
  if (idCierre) {
    params.push(idCierre);
    condiciones.push(`m.id_cierre = $${params.length}`);
  }
  params.push(limite);
  const where = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await db.query(
    `SELECT m.id_entrante, m.id_mensaje, m.origen, m.tipo_evento, m.id_cierre, m.destino,
            m.carga, m.estado, m.intentos, m.ultimo_error, m.recibido_en, m.procesado_en
       FROM MENSAJES_CIERRE_ENTRANTES m
       ${where}
      ORDER BY m.recibido_en DESC, m.id_entrante DESC
      LIMIT $${params.length}`,
    params
  );
  return rows;
}

async function listarRecibidosAntiguos(segundos = 30, db = pool) {
  const { rows } = await db.query(
    `SELECT id_entrante
       FROM MENSAJES_CIERRE_ENTRANTES
      WHERE estado = 'RECIBIDO'
        AND recibido_en < CURRENT_TIMESTAMP - make_interval(secs => $1)
      ORDER BY recibido_en ASC`,
    [segundos]
  );
  return rows;
}

async function reservarRevocacionesVencidas(cliente, limite = 10) {
  const { rows } = await cliente.query(
    `SELECT r.id_revocacion, r.id_cierre, r.destino, r.estado, r.plazo_vence_en, r.reenvios_por_plazo,
            c.id_proceso, c.id_empleado, c.cerrado_por, c.cerrado_en,
            p.nombre_empleado, to_char(p.fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro, p.codigo_causal
       FROM REVOCACIONES_SISTEMA r
       JOIN CIERRES_DESVINCULACION c ON c.id_cierre = r.id_cierre
       JOIN PROCESOS_DESVINCULACION p ON p.id_proceso = c.id_proceso
      WHERE r.estado = 'ENVIADA'
        AND r.plazo_vence_en IS NOT NULL
        AND r.plazo_vence_en < CURRENT_TIMESTAMP
      ORDER BY r.plazo_vence_en ASC, r.id_revocacion ASC
      LIMIT $1
      FOR UPDATE OF r SKIP LOCKED`,
    [limite]
  );
  return rows;
}

async function marcarRevocacionReenvioPorPlazo(cliente, idRevocacion) {
  await cliente.query(
    `UPDATE REVOCACIONES_SISTEMA
        SET estado = 'PENDIENTE',
            plazo_vence_en = NULL,
            reenvios_por_plazo = reenvios_por_plazo + 1,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_revocacion = $1
        AND estado = 'ENVIADA'`,
    [idRevocacion]
  );
}

async function marcarRevocacionVencida(cliente, idRevocacion, motivo) {
  await cliente.query(
    `UPDATE REVOCACIONES_SISTEMA
        SET estado = 'VENCIDA',
            motivo = left($2, 255),
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_revocacion = $1
        AND estado = 'ENVIADA'`,
    [idRevocacion, motivo]
  );
}

module.exports = {
  listarProcesosParaCierre,
  obtenerProcesoParaCierre,
  obtenerFiniquitoDeProceso,
  obtenerCierrePorProceso,
  crearCierre,
  crearRevocacionesIniciales,
  cerrarProcesoDesvinculacion,
  listarRevocacionesCierre,
  ultimosEnviosPorDestino,
  registrarEvento,
  reservarEventosPendientes,
  marcarEventoEntregado,
  marcarEventoError,
  marcarRevocacionEnviada,
  bloquearRevocacionesCierre,
  prepararReenvioRevocacion,
  actualizarEstadoCierre,
  obtenerUltimaRespuestaEntrante,
  bloquearCierrePorId,
  listarEnviosSalientesDestino,
  actualizarRevocacionConfirmada,
  actualizarRevocacionRechazada,
  registrarMensajeEntrante,
  obtenerMensajeEntrante,
  bloquearMensajeEntrante,
  marcarMensajeEntranteProcesado,
  marcarMensajeEntranteIgnorado,
  registrarFalloMensajeEntrante,
  enviarMensajeEntranteADlq,
  reabrirMensajeEntrante,
  listarMensajesEntrantes,
  listarRecibidosAntiguos,
  reservarRevocacionesVencidas,
  marcarRevocacionReenvioPorPlazo,
  marcarRevocacionVencida,
};
