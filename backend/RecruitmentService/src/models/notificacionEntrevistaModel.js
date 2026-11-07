const pool = require("../../db/pool");
const { ESTADO_EVENTO } = require("../utils/integracion");

const COLUMNAS = `n.id_notificacion, n.id_entrevista, n.tipo_notificacion, n.correo_destino, n.id_estado_evento,
  ee.codigo AS codigo_estado, ee.nombre AS nombre_estado, n.intentos, n.ultimo_error, n.proximo_intento_en,
  n.enviado_en, n.creado_en`;

// Un aviso nuevo reemplaza a los que no llegaron a salir. Devuelve los tipos descartados.
async function descartarPendientes(client, idEntrevista) {
  const { rows } = await client.query(
    `UPDATE NOTIFICACIONES_ENTREVISTA
        SET id_estado_evento = $2
      WHERE id_entrevista = $1 AND id_estado_evento = ANY($3::smallint[])
      RETURNING tipo_notificacion`,
    [idEntrevista, ESTADO_EVENTO.DESCARTADO, [ESTADO_EVENTO.PENDIENTE, ESTADO_EVENTO.FALLIDO]],
  );
  return rows.map((fila) => fila.tipo_notificacion);
}

// ¿El candidato ya recibió algún correo de esta entrevista?
async function huboEntrega(client, idEntrevista) {
  const { rows } = await client.query(
    "SELECT 1 FROM NOTIFICACIONES_ENTREVISTA WHERE id_entrevista = $1 AND id_estado_evento = $2 LIMIT 1",
    [idEntrevista, ESTADO_EVENTO.ENTREGADO],
  );
  return rows.length > 0;
}

async function registrar(client, { idEntrevista, tipo, correo, carga }) {
  const { rows } = await client.query(
    `WITH nueva AS (
       INSERT INTO NOTIFICACIONES_ENTREVISTA (id_entrevista, tipo_notificacion, correo_destino, carga)
       VALUES ($1, $2, $3, $4)
       RETURNING *)
     SELECT ${COLUMNAS}
       FROM nueva n
       INNER JOIN CATALOGOS_ESTADO_EVENTO ee ON ee.id_estado_evento = n.id_estado_evento`,
    [idEntrevista, tipo, correo, carga],
  );
  return rows[0];
}

// Reserva hasta `limite` avisos vencidos; otro ciclo no los toma mientras dure la reserva.
async function reservarPendientes(limite, segundosReserva) {
  const { rows } = await pool.query(
    `UPDATE NOTIFICACIONES_ENTREVISTA
        SET proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $2)
      WHERE id_notificacion IN (
        SELECT id_notificacion
          FROM NOTIFICACIONES_ENTREVISTA
         WHERE id_estado_evento = $3 AND proximo_intento_en <= CURRENT_TIMESTAMP
         ORDER BY creado_en
         LIMIT $1
         FOR UPDATE SKIP LOCKED)
      RETURNING id_notificacion`,
    [limite, segundosReserva, ESTADO_EVENTO.PENDIENTE],
  );
  return rows.map((fila) => fila.id_notificacion);
}

/**
 * Bloquea la entrevista y luego el aviso (el mismo orden que reprogramar o cancelar), y los mantiene bloqueados
 * mientras se envía el correo: así un cambio de la cita espera a saber si el aviso anterior salió o no.
 * Devuelve null si el aviso ya no está pendiente (se envió o fue descartado).
 */
async function bloquearParaEnvio(client, idNotificacion) {
  await client.query(
    `SELECT 1 FROM ENTREVISTAS
      WHERE id_entrevista = (SELECT id_entrevista FROM NOTIFICACIONES_ENTREVISTA WHERE id_notificacion = $1)
      FOR UPDATE`,
    [idNotificacion],
  );
  const { rows } = await client.query(
    `SELECT id_notificacion, id_entrevista, tipo_notificacion, correo_destino, carga, intentos
       FROM NOTIFICACIONES_ENTREVISTA
      WHERE id_notificacion = $1 AND id_estado_evento = $2
      FOR UPDATE`,
    [idNotificacion, ESTADO_EVENTO.PENDIENTE],
  );
  return rows[0] || null;
}

async function marcarEnviada(client, notificacion) {
  await client.query(
    `UPDATE NOTIFICACIONES_ENTREVISTA
        SET id_estado_evento = $2, enviado_en = CURRENT_TIMESTAMP, intentos = intentos + 1, ultimo_error = NULL
      WHERE id_notificacion = $1`,
    [notificacion.id_notificacion, ESTADO_EVENTO.ENTREGADO],
  );
  await client.query("UPDATE ENTREVISTAS SET notificacion_enviada = TRUE WHERE id_entrevista = $1", [
    notificacion.id_entrevista,
  ]);
}

// fallido: el aviso deja de reintentarse (dirección rechazada o intentos agotados).
async function marcarError(client, idNotificacion, { error, esperaMs, fallido = false }) {
  await client.query(
    `UPDATE NOTIFICACIONES_ENTREVISTA
        SET intentos = intentos + 1, ultimo_error = left($2, 255),
            proximo_intento_en = CURRENT_TIMESTAMP + make_interval(secs => $3),
            id_estado_evento = CASE WHEN $4 THEN $5::smallint ELSE id_estado_evento END
      WHERE id_notificacion = $1`,
    [idNotificacion, error, esperaMs / 1000, fallido, ESTADO_EVENTO.FALLIDO],
  );
}

// Reintento manual: el aviso vuelve a PENDIENTE con el contador en cero y sale en el siguiente ciclo.
async function reencolar(idNotificacion) {
  const { rowCount } = await pool.query(
    `UPDATE NOTIFICACIONES_ENTREVISTA
        SET id_estado_evento = $2, intentos = 0, ultimo_error = NULL, proximo_intento_en = CURRENT_TIMESTAMP
      WHERE id_notificacion = $1 AND id_estado_evento = $3`,
    [idNotificacion, ESTADO_EVENTO.PENDIENTE, ESTADO_EVENTO.FALLIDO],
  );
  return rowCount > 0;
}

async function obtener(idNotificacion) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS}
       FROM NOTIFICACIONES_ENTREVISTA n
       INNER JOIN CATALOGOS_ESTADO_EVENTO ee ON ee.id_estado_evento = n.id_estado_evento
      WHERE n.id_notificacion = $1`,
    [idNotificacion],
  );
  return rows[0] || null;
}

async function listarPorEntrevista(idEntrevista) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS}
       FROM NOTIFICACIONES_ENTREVISTA n
       INNER JOIN CATALOGOS_ESTADO_EVENTO ee ON ee.id_estado_evento = n.id_estado_evento
      WHERE n.id_entrevista = $1
      ORDER BY n.creado_en DESC`,
    [idEntrevista],
  );
  return rows;
}

module.exports = {
  descartarPendientes,
  huboEntrega,
  registrar,
  reservarPendientes,
  bloquearParaEnvio,
  marcarEnviada,
  marcarError,
  reencolar,
  obtener,
  listarPorEntrevista,
};
