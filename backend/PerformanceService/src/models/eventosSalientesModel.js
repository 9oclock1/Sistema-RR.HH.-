const pool = require("../config/db");
const { MODULO_EXTERNO } = require("../utils/ciclos");
const { ESTADO_EVENTO, TIPO_SOLICITUD_METRICAS_CRM } = require("../utils/mensajeria");

// Toma los eventos pendientes para el CRM y los reserva: `proximo_intento_en` se corre unos segundos para que otra
// vuelta (u otra instancia) no los publique al mismo tiempo. SKIP LOCKED evita esperar a quien ya los tomó.
async function reservarPendientes(limite, segundosReserva, db = pool) {
  const { rows } = await db.query(
    `UPDATE eventos_salientes ev
        SET proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $2)
      WHERE ev.id_evento IN (
          SELECT e.id_evento FROM eventos_salientes e
           WHERE e.id_estado_evento = ${ESTADO_EVENTO.PENDIENTE}
             AND e.id_modulo_destino = ${MODULO_EXTERNO.CRM}
             AND e.tipo_evento = '${TIPO_SOLICITUD_METRICAS_CRM}'
             AND e.proximo_intento_en <= CURRENT_TIMESTAMP
           ORDER BY e.creado_en
           LIMIT $1
           FOR UPDATE SKIP LOCKED)
      RETURNING ev.id_evento, ev.id_ciclo, ev.tipo_evento, ev.carga, ev.intentos`,
    [limite, segundosReserva],
  );
  return rows;
}

// Datos del ciclo y de su periodo para armar el mensaje (el evento guardado solo trae los ids de los evaluados).
async function obtenerCicloConPeriodo(idCiclo, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id_ciclo, c.nombre, c.fecha_inicio, c.fecha_limite, c.cerrado_en,
            pe.id_periodo, pe.nombre AS periodo,
            pe.fecha_inicio AS periodo_fecha_inicio, pe.fecha_fin AS periodo_fecha_fin
     FROM ciclos_evaluacion c
     JOIN periodos_evaluacion pe ON pe.id_periodo = c.id_periodo
     WHERE c.id_ciclo = $1`,
    [idCiclo],
  );
  return rows[0] ?? null;
}

// Solo pasa a ENTREGADO lo que sigue pendiente: si otro proceso ya lo cerró, no se pisa.
async function marcarEntregado(idEvento, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE eventos_salientes
        SET id_estado_evento = ${ESTADO_EVENTO.ENTREGADO}, entregado_en = CURRENT_TIMESTAMP,
            intentos = intentos + 1, ultimo_error = NULL
      WHERE id_evento = $1 AND id_estado_evento = ${ESTADO_EVENTO.PENDIENTE}`,
    [idEvento],
  );
  return rowCount > 0;
}

// No hay a quién pedirle métricas: no se publica nada y queda constancia del motivo.
async function marcarOmitido(idEvento, motivo, db = pool) {
  await db.query(
    `UPDATE eventos_salientes
        SET id_estado_evento = ${ESTADO_EVENTO.OMITIDO}, ultimo_error = left($2, 255)
      WHERE id_evento = $1 AND id_estado_evento = ${ESTADO_EVENTO.PENDIENTE}`,
    [idEvento, motivo],
  );
}

// fallido: el evento deja de reintentarse (error permanente o intentos agotados).
async function marcarError(idEvento, { error, esperaMs, fallido = false }, db = pool) {
  await db.query(
    `UPDATE eventos_salientes
        SET intentos = intentos + 1, ultimo_error = left($2, 255),
            proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3),
            id_estado_evento = CASE WHEN $4 THEN ${ESTADO_EVENTO.FALLIDO}::smallint ELSE id_estado_evento END
      WHERE id_evento = $1 AND id_estado_evento = ${ESTADO_EVENTO.PENDIENTE}`,
    [idEvento, error, esperaMs / 1000, fallido],
  );
}

// Reintento manual: el evento vuelve a PENDIENTE con el contador en cero y sale en la siguiente vuelta.
async function reencolar(idEvento, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE eventos_salientes
        SET id_estado_evento = ${ESTADO_EVENTO.PENDIENTE}, intentos = 0, ultimo_error = NULL,
            proximo_intento_en = CURRENT_TIMESTAMP
      WHERE id_evento = $1 AND id_estado_evento = ${ESTADO_EVENTO.FALLIDO}`,
    [idEvento],
  );
  return rowCount > 0;
}

module.exports = {
  reservarPendientes,
  obtenerCicloConPeriodo,
  marcarEntregado,
  marcarOmitido,
  marcarError,
  reencolar,
};
