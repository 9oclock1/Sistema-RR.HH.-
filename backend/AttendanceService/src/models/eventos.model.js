const pool = require("../config/db");

const conEstado = (origen) => `
  SELECT ev.id_evento, ev.topico, ev.tipo_evento, ev.id_rol, ev.intentos, ev.ultimo_error,
         ev.proximo_intento_en, ev.entregado_en, ev.creado_en,
         es.codigo AS estado_codigo, es.nombre AS estado_nombre
  FROM ${origen} ev JOIN catalogos_estado_evento es USING (id_estado_evento)`;

async function registrar(cliente, { idEvento = null, topico, tipoEvento, idRol, carga }) {
  await cliente.query(
    `INSERT INTO eventos_salientes (id_evento, topico, tipo_evento, id_rol, carga)
     VALUES (COALESCE($1::uuid, gen_random_uuid()), $2, $3, $4, $5)`,
    [idEvento, topico, tipoEvento, idRol, carga]
  );
}

// Reserva hasta `limite` eventos vencidos de los tópicos con destino; otro proceso no los toma mientras dure la reserva.
async function reservarPendientes(topicos, limite, segundosReserva) {
  const { rows } = await pool.query(
    `UPDATE eventos_salientes SET proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3)
     WHERE id_evento IN (
       SELECT id_evento FROM eventos_salientes
       WHERE id_estado_evento = 1 AND proximo_intento_en <= CURRENT_TIMESTAMP AND topico = ANY($1::text[])
       ORDER BY creado_en
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     RETURNING id_evento, topico, tipo_evento, carga, intentos`,
    [topicos, limite, segundosReserva]
  );
  return rows;
}

async function marcarEntregado(id) {
  const { rowCount } = await pool.query(
    `UPDATE eventos_salientes
     SET id_estado_evento = 2, entregado_en = CURRENT_TIMESTAMP, intentos = intentos + 1, ultimo_error = NULL
     WHERE id_evento = $1 AND id_estado_evento <> 2`,
    [id]
  );
  return rowCount;
}

async function marcarError(id, { error, esperaMs, fallido }) {
  await pool.query(
    `UPDATE eventos_salientes
     SET intentos = intentos + 1, ultimo_error = left($2, 255),
         proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3),
         id_estado_evento = CASE WHEN $4 THEN 3 ELSE id_estado_evento END
     WHERE id_evento = $1`,
    [id, error, esperaMs / 1000, fallido]
  );
}

async function listarPorRol(idRol) {
  const { rows } = await pool.query(`${conEstado("eventos_salientes")} WHERE ev.id_rol = $1 ORDER BY ev.creado_en DESC`, [
    idRol,
  ]);
  return rows;
}

async function listar({ topico = null, estado = null, limite }) {
  const { rows } = await pool.query(
    `SELECT ev.*, es.codigo AS estado_codigo FROM eventos_salientes ev
     JOIN catalogos_estado_evento es USING (id_estado_evento)
     WHERE ($1::text IS NULL OR ev.topico = $1) AND ($2::text IS NULL OR es.codigo = $2)
     ORDER BY ev.creado_en
     LIMIT $3`,
    [topico, estado, limite]
  );
  return rows;
}

async function obtener(id) {
  const { rows } = await pool.query(`${conEstado("eventos_salientes")} WHERE ev.id_evento = $1`, [id]);
  return rows[0];
}

module.exports = { registrar, reservarPendientes, marcarEntregado, marcarError, listarPorRol, listar, obtener };
