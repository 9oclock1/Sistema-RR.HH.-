const pool = require("../config/db");

const COLUMNAS = `id_notificacion, id_empleado, tipo, titulo, mensaje, enlace, id_referencia, leida,
                  fecha_lectura, correo_estado, correo_detalle, creado_en`;

// Devuelve la notificación y si fue creada ahora; si el evento ya había notificado a ese empleado, devuelve la existente.
async function crear({ idEmpleado, tipo, titulo, mensaje, enlace, idReferencia }) {
  const { rows } = await pool.query(
    `INSERT INTO notificaciones (id_empleado, tipo, titulo, mensaje, enlace, id_referencia)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tipo, id_referencia, id_empleado) WHERE id_referencia IS NOT NULL DO NOTHING
     RETURNING ${COLUMNAS}`,
    [idEmpleado, tipo, titulo, mensaje, enlace, idReferencia]
  );
  if (rows[0]) return { notificacion: rows[0], creada: true };
  const existente = await pool.query(
    `SELECT ${COLUMNAS} FROM notificaciones WHERE tipo = $1 AND id_referencia = $2 AND id_empleado = $3`,
    [tipo, idReferencia, idEmpleado]
  );
  return { notificacion: existente.rows[0], creada: false };
}

async function registrarCorreo(idNotificacion, estado, detalle) {
  await pool.query(`UPDATE notificaciones SET correo_estado = $2, correo_detalle = $3 WHERE id_notificacion = $1`, [
    idNotificacion,
    estado,
    detalle?.slice(0, 200) ?? null,
  ]);
}

async function listar(idEmpleado, { soloNoLeidas, limite, desplazamiento }) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS} FROM notificaciones
     WHERE id_empleado = $1 AND ($2::boolean IS FALSE OR NOT leida)
     ORDER BY creado_en DESC, id_notificacion DESC
     LIMIT $3 OFFSET $4`,
    [idEmpleado, soloNoLeidas, limite, desplazamiento]
  );
  return rows;
}

async function contarNoLeidas(idEmpleado) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS cantidad FROM notificaciones WHERE id_empleado = $1 AND NOT leida`,
    [idEmpleado]
  );
  return rows[0].cantidad;
}

// Total de alertas del empleado (todas, o solo las no leídas): permite paginar la vista completa.
async function contarTotal(idEmpleado, soloNoLeidas) {
  const { rows } = await pool.query(
    `SELECT count(*)::int AS cantidad FROM notificaciones WHERE id_empleado = $1 AND ($2::boolean IS FALSE OR NOT leida)`,
    [idEmpleado, soloNoLeidas]
  );
  return rows[0].cantidad;
}

// Solo el dueño puede marcarla; conserva la fecha de la primera lectura si ya estaba leída.
async function marcarLeida(idNotificacion, idEmpleado) {
  const { rows } = await pool.query(
    `UPDATE notificaciones
        SET leida = true, fecha_lectura = COALESCE(fecha_lectura, current_timestamp)
      WHERE id_notificacion = $1 AND id_empleado = $2
      RETURNING ${COLUMNAS}`,
    [idNotificacion, idEmpleado]
  );
  return rows[0];
}

async function marcarTodasLeidas(idEmpleado) {
  const { rowCount } = await pool.query(
    `UPDATE notificaciones SET leida = true, fecha_lectura = current_timestamp
      WHERE id_empleado = $1 AND NOT leida`,
    [idEmpleado]
  );
  return rowCount;
}

module.exports = { crear, registrarCorreo, listar, contarNoLeidas, contarTotal, marcarLeida, marcarTodasLeidas };
