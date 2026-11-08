const pool = require("../config/db");

const COLUMNAS = `id_evento, topico, tipo_evento, id_planilla, destino, estado, intentos, ultimo_error,
  proximo_intento_en, entregado_en, creado_en`;

async function registrar(cliente, { idEvento, topico, tipoEvento, idPlanilla, destino, carga }) {
  await cliente.query(
    `INSERT INTO eventos_salientes (id_evento, topico, tipo_evento, id_planilla, destino, carga)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [idEvento, topico, tipoEvento, idPlanilla, destino, carga]
  );
}

// Reserva hasta `limite` eventos vencidos; otro proceso no los toma mientras dure la reserva.
async function reservarPendientes(limite, segundosReserva) {
  const { rows } = await pool.query(
    `UPDATE eventos_salientes SET proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $2)
     WHERE id_evento IN (
       SELECT id_evento FROM eventos_salientes
       WHERE estado = 'PENDIENTE' AND proximo_intento_en <= CURRENT_TIMESTAMP
       ORDER BY creado_en
       LIMIT $1
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id_evento, topico, tipo_evento, carga, intentos`,
    [limite, segundosReserva]
  );
  return rows;
}

async function marcarEntregado(id) {
  await pool.query(
    `UPDATE eventos_salientes
     SET estado = 'ENTREGADO', entregado_en = CURRENT_TIMESTAMP, intentos = intentos + 1, ultimo_error = NULL
     WHERE id_evento = $1 AND estado = 'PENDIENTE'`,
    [id]
  );
}

async function marcarError(id, { error, esperaMs, fallido }) {
  await pool.query(
    `UPDATE eventos_salientes
     SET intentos = intentos + 1, ultimo_error = left($2, 255),
         proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3),
         estado = CASE WHEN $4 THEN 'FALLIDO' ELSE estado END
     WHERE id_evento = $1 AND estado = 'PENDIENTE'`,
    [id, error, esperaMs / 1000, fallido]
  );
}

// Un envío fallido vuelve a la cola con el mismo mensaje (mismo id_mensaje).
async function reencolar(cliente, id) {
  const { rowCount } = await cliente.query(
    `UPDATE eventos_salientes
     SET estado = 'PENDIENTE', intentos = 0, ultimo_error = NULL, proximo_intento_en = CURRENT_TIMESTAMP
     WHERE id_evento = $1 AND estado = 'FALLIDO'`,
    [id]
  );
  return rowCount === 1;
}

// Último envío de la planilla a cada destino.
async function ultimosDePlanilla(db, idPlanilla) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (destino) ${COLUMNAS}
     FROM eventos_salientes
     WHERE id_planilla = $1
     ORDER BY destino, creado_en DESC, id_evento`,
    [idPlanilla]
  );
  return Object.fromEntries(rows.map((r) => [r.destino, r]));
}

module.exports = { registrar, reservarPendientes, marcarEntregado, marcarError, reencolar, ultimosDePlanilla };
