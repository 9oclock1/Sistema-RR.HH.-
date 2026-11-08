const pool = require("../config/db");

const COLUMNAS = `id_evento_entrante, id_mensaje, topico, tipo_evento, origen, id_planilla, destino, carga, estado,
  intentos, detalle, recibido_en, procesado_en`;

// Registra el mensaje si es nuevo y lo bloquea: dos entregas del mismo mensaje no se procesan a la vez.
async function reclamar(cliente, { idMensaje, topico, tipoEvento, origen, carga }) {
  await cliente.query(
    `INSERT INTO eventos_entrantes (id_mensaje, topico, tipo_evento, origen, carga)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id_mensaje) DO NOTHING`,
    [idMensaje, topico, tipoEvento, origen, carga]
  );
  const { rows } = await cliente.query(`SELECT ${COLUMNAS} FROM eventos_entrantes WHERE id_mensaje = $1 FOR UPDATE`, [
    idMensaje,
  ]);
  return rows[0];
}

// Termina un intento: PROCESADO, IGNORADO o FALLIDO (inválido).
async function cerrar(cliente, id, { estado, detalle = null, idPlanilla = null, destino = null }) {
  await cliente.query(
    `UPDATE eventos_entrantes
     SET estado = $2::text, detalle = left($3, 255), id_planilla = COALESCE($4, id_planilla), destino = COALESCE($5, destino),
         intentos = intentos + 1,
         procesado_en = CASE WHEN $2::text IN ('PROCESADO', 'IGNORADO') THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id_evento_entrante = $1`,
    [id, estado, detalle, idPlanilla, destino]
  );
}

// Un intento que falló por un error pasajero (la base, por ejemplo). Tras `maximo` intentos queda FALLIDO.
async function registrarFallo({ idMensaje, topico, tipoEvento, origen, carga, detalle, maximo }) {
  const { rows } = await pool.query(
    `INSERT INTO eventos_entrantes AS e (id_mensaje, topico, tipo_evento, origen, carga, intentos, detalle,
                                         estado)
     VALUES ($1, $2, $3, $4, $5, 1, left($6, 255), CASE WHEN 1 >= $7 THEN 'FALLIDO' ELSE 'RECIBIDO' END)
     ON CONFLICT (id_mensaje) DO UPDATE
     SET intentos = e.intentos + 1, detalle = left($6, 255),
         estado = CASE WHEN e.intentos + 1 >= $7 THEN 'FALLIDO' ELSE e.estado END
     WHERE e.estado = 'RECIBIDO'
     RETURNING estado, intentos`,
    [idMensaje, topico, tipoEvento, origen, carga, detalle, maximo]
  );
  return rows[0];
}

async function listar({ estado = null, limite }) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM eventos_entrantes
     WHERE $1::text IS NULL OR estado = $1
     ORDER BY recibido_en DESC
     LIMIT $2`,
    [estado, limite]
  );
  return rows;
}

async function obtener(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM eventos_entrantes WHERE id_evento_entrante = $1`, [id]);
  return rows[0];
}

// Un mensaje fallido vuelve a RECIBIDO para procesarlo otra vez.
async function reabrir(id) {
  const { rows } = await pool.query(
    `UPDATE eventos_entrantes SET estado = 'RECIBIDO', intentos = 0, detalle = NULL
     WHERE id_evento_entrante = $1 AND estado = 'FALLIDO'
     RETURNING ${COLUMNAS}`,
    [id]
  );
  return rows[0];
}

async function devolverAFallido(id, detalle) {
  await pool.query(
    `UPDATE eventos_entrantes SET estado = 'FALLIDO', detalle = left($2, 255)
     WHERE id_evento_entrante = $1 AND estado = 'RECIBIDO'`,
    [id, detalle]
  );
}

module.exports = { reclamar, cerrar, registrarFallo, listar, obtener, reabrir, devolverAFallido };
