const pool = require("../config/db");

async function listarTiposAccion(db = pool) {
  const { rows } = await db.query(
    `SELECT id_tipo_accion_queja, codigo, nombre FROM catalogos_tipo_accion_queja ORDER BY id_tipo_accion_queja`,
  );
  return rows;
}

async function listarAcciones(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id_accion, a.descripcion, a.creado_en,
            t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
            a.id_empleado_registrador, e.nombres, e.apellidos
     FROM acciones_queja a
     JOIN catalogos_tipo_accion_queja t ON t.id_tipo_accion_queja = a.id_tipo_accion_queja
     JOIN empleados e ON e.id_empleado = a.id_empleado_registrador
     WHERE a.id_queja = $1
     ORDER BY a.creado_en, a.id_accion`,
    [idQueja],
  );
  return rows;
}

async function insertarAccion(db, { idQueja, idTipo, idEmpleado, descripcion }) {
  const { rows } = await db.query(
    `WITH nueva AS (
       INSERT INTO acciones_queja (id_queja, id_tipo_accion_queja, id_empleado_registrador, descripcion)
       VALUES ($1, $2, $3, $4)
       RETURNING id_accion, id_tipo_accion_queja, id_empleado_registrador, creado_en
     )
     SELECT n.id_accion, n.creado_en, t.codigo AS tipo_codigo, t.nombre AS tipo_nombre, e.nombres, e.apellidos
     FROM nueva n
     JOIN catalogos_tipo_accion_queja t ON t.id_tipo_accion_queja = n.id_tipo_accion_queja
     JOIN empleados e ON e.id_empleado = n.id_empleado_registrador`,
    [idQueja, idTipo, idEmpleado, descripcion],
  );
  return rows[0];
}

async function obtenerSituacion(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT q.id_estado_queja, eq.es_final, q.resolucion, q.aviso_resolucion_en,
            ce.codigo AS aviso_codigo, ce.nombre AS aviso_nombre
     FROM quejas q
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = q.id_estado_queja
     LEFT JOIN catalogos_estado_evento ce ON ce.id_estado_evento = q.id_estado_aviso_resolucion
     WHERE q.id_queja = $1`,
    [idQueja],
  );
  return rows[0] ?? null;
}

async function cambiarEstado(db, { idQueja, idEstado, resolucion, idEstadoAviso }) {
  const { rows } = await db.query(
    `UPDATE quejas
     SET id_estado_queja = $2,
         resolucion = $3,
         id_estado_aviso_resolucion = $4,
         actualizado_en = CURRENT_TIMESTAMP
     WHERE id_queja = $1
     RETURNING actualizado_en`,
    [idQueja, idEstado, resolucion, idEstadoAviso],
  );
  return rows[0];
}

async function insertarTransicion(db, { idQueja, idEstadoAnterior, idEstado, idEmpleado }) {
  const { rows } = await db.query(
    `INSERT INTO historiales_estado_queja (id_queja, id_estado_anterior, id_estado_queja, id_empleado_responsable)
     VALUES ($1, $2, $3, $4)
     RETURNING fecha_cambio`,
    [idQueja, idEstadoAnterior, idEstado, idEmpleado],
  );
  return rows[0];
}

async function obtenerDatosAvisoResolucion(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT codigo_seguimiento, es_anonima, id_empleado_denunciante, id_estado_aviso_resolucion
     FROM quejas
     WHERE id_queja = $1`,
    [idQueja],
  );
  return rows[0] ?? null;
}

async function registrarAvisoResolucion(idQueja, idEstado, db = pool) {
  const { rows } = await db.query(
    `UPDATE quejas
     SET id_estado_aviso_resolucion = $2::smallint,
         aviso_resolucion_en = CASE WHEN $2::smallint = 2 THEN CURRENT_TIMESTAMP END
     WHERE id_queja = $1 AND NOT es_anonima AND resolucion IS NOT NULL
     RETURNING aviso_resolucion_en`,
    [idQueja, idEstado],
  );
  return rows[0] ?? null;
}

module.exports = {
  listarTiposAccion,
  listarAcciones,
  insertarAccion,
  obtenerSituacion,
  cambiarEstado,
  insertarTransicion,
  obtenerDatosAvisoResolucion,
  registrarAvisoResolucion,
};
