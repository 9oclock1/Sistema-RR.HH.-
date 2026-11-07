const pool = require("../config/db");

async function listarPrioridades(db = pool) {
  const { rows } = await db.query(
    `SELECT id_prioridad_queja, codigo, nombre FROM catalogos_prioridad_queja ORDER BY id_prioridad_queja`,
  );
  return rows;
}

async function listarEstados(db = pool) {
  const { rows } = await db.query(
    `SELECT id_estado_queja, codigo, nombre, es_final FROM catalogos_estado_queja ORDER BY id_estado_queja`,
  );
  return rows;
}

const FILTROS_BANDEJA = `($1::smallint IS NULL OR q.id_estado_queja = $1)
   AND ($2::smallint IS NULL OR q.id_categoria_queja = $2)
   AND ($3::smallint IS NULL OR q.id_prioridad_queja = $3)
   AND ($4::boolean IS FALSE OR q.id_prioridad_queja IS NULL)`;

const parametrosFiltro = ({ idEstado, idCategoria, idPrioridad, sinPrioridad }) => [
  idEstado,
  idCategoria,
  idPrioridad,
  sinPrioridad,
];

async function listarCasos(filtros, db = pool) {
  const { rows } = await db.query(
    `SELECT q.id_queja, q.codigo_seguimiento, q.es_anonima, q.creado_en, q.actualizado_en,
            cq.id_categoria_queja, cq.codigo AS categoria_codigo, cq.nombre AS categoria_nombre,
            pq.id_prioridad_queja, pq.codigo AS prioridad_codigo, pq.nombre AS prioridad_nombre,
            eq.id_estado_queja, eq.codigo AS estado_codigo, eq.nombre AS estado_nombre, eq.es_final,
            a.id_empleado_responsable, r.nombres AS responsable_nombres, r.apellidos AS responsable_apellidos
     FROM quejas q
     JOIN catalogos_categoria_queja cq ON cq.id_categoria_queja = q.id_categoria_queja
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = q.id_estado_queja
     LEFT JOIN catalogos_prioridad_queja pq ON pq.id_prioridad_queja = q.id_prioridad_queja
     LEFT JOIN LATERAL (
       SELECT id_empleado_responsable FROM asignaciones_queja
       WHERE id_queja = q.id_queja
       ORDER BY asignada_en DESC
       LIMIT 1
     ) a ON TRUE
     LEFT JOIN empleados r ON r.id_empleado = a.id_empleado_responsable
     WHERE ${FILTROS_BANDEJA}
     ORDER BY q.creado_en DESC, q.id_queja
     LIMIT $5 OFFSET $6`,
    [...parametrosFiltro(filtros), filtros.limite, (filtros.pagina - 1) * filtros.limite],
  );
  return rows;
}

async function contarCasos(filtros, db = pool) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS total FROM quejas q WHERE ${FILTROS_BANDEJA}`,
    parametrosFiltro(filtros),
  );
  return rows[0].total;
}

async function obtenerCaso(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT q.id_queja, q.codigo_seguimiento, q.es_anonima, q.asunto, q.descripcion, q.creado_en, q.actualizado_en,
            q.id_empleado_denunciante, d.nombres AS denunciante_nombres, d.apellidos AS denunciante_apellidos,
            cq.id_categoria_queja, cq.codigo AS categoria_codigo, cq.nombre AS categoria_nombre,
            pq.id_prioridad_queja, pq.codigo AS prioridad_codigo, pq.nombre AS prioridad_nombre,
            eq.id_estado_queja, eq.codigo AS estado_codigo, eq.nombre AS estado_nombre, eq.es_final
     FROM quejas q
     JOIN catalogos_categoria_queja cq ON cq.id_categoria_queja = q.id_categoria_queja
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = q.id_estado_queja
     LEFT JOIN catalogos_prioridad_queja pq ON pq.id_prioridad_queja = q.id_prioridad_queja
     LEFT JOIN empleados d ON d.id_empleado = q.id_empleado_denunciante
     WHERE q.id_queja = $1`,
    [idQueja],
  );
  return rows[0] ?? null;
}

async function listarAdjuntos(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT orden, nombre_original, tipo_mime, tamano_bytes FROM adjuntos_queja WHERE id_queja = $1 ORDER BY orden`,
    [idQueja],
  );
  return rows;
}

async function listarHistorial(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT h.fecha_cambio, h.comentario,
            ea.codigo AS anterior_codigo, ea.nombre AS anterior_nombre,
            eq.codigo AS estado_codigo, eq.nombre AS estado_nombre,
            h.id_empleado_responsable, e.nombres, e.apellidos
     FROM historiales_estado_queja h
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = h.id_estado_queja
     LEFT JOIN catalogos_estado_queja ea ON ea.id_estado_queja = h.id_estado_anterior
     LEFT JOIN empleados e ON e.id_empleado = h.id_empleado_responsable
     WHERE h.id_queja = $1
     ORDER BY h.fecha_cambio`,
    [idQueja],
  );
  return rows;
}

async function listarAsignaciones(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id_asignacion, a.comentario, a.asignada_en, a.notificada_en,
            ce.codigo AS notificacion_codigo, ce.nombre AS notificacion_nombre,
            a.id_empleado_responsable, r.nombres AS responsable_nombres, r.apellidos AS responsable_apellidos,
            a.id_empleado_asignador, s.nombres AS asignador_nombres, s.apellidos AS asignador_apellidos
     FROM asignaciones_queja a
     JOIN catalogos_estado_evento ce ON ce.id_estado_evento = a.id_estado_notificacion
     JOIN empleados r ON r.id_empleado = a.id_empleado_responsable
     JOIN empleados s ON s.id_empleado = a.id_empleado_asignador
     WHERE a.id_queja = $1
     ORDER BY a.asignada_en DESC`,
    [idQueja],
  );
  return rows;
}

async function listarInvolucrados(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT i.id_empleado, e.nombres, e.apellidos, i.registrado_en
     FROM involucrados_queja i
     JOIN empleados e ON e.id_empleado = i.id_empleado
     WHERE i.id_queja = $1
     ORDER BY i.registrado_en`,
    [idQueja],
  );
  return rows;
}

async function bloquearQueja(db, idQueja) {
  const { rows } = await db.query(
    `SELECT q.id_queja, q.id_empleado_denunciante, q.id_categoria_queja, q.id_prioridad_queja, q.id_estado_queja,
            eq.es_final
     FROM quejas q
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = q.id_estado_queja
     WHERE q.id_queja = $1
     FOR UPDATE OF q`,
    [idQueja],
  );
  return rows[0] ?? null;
}

async function obtenerResponsableVigente(db, idQueja) {
  const { rows } = await db.query(
    `SELECT id_empleado_responsable FROM asignaciones_queja
     WHERE id_queja = $1
     ORDER BY asignada_en DESC
     LIMIT 1`,
    [idQueja],
  );
  return rows[0]?.id_empleado_responsable ?? null;
}

async function esInvolucrado(db, idQueja, idEmpleado) {
  const { rows } = await db.query(`SELECT 1 FROM involucrados_queja WHERE id_queja = $1 AND id_empleado = $2`, [
    idQueja,
    idEmpleado,
  ]);
  return rows.length > 0;
}

async function actualizarQueja(db, { idQueja, idCategoria = null, idPrioridad = null, idEstado = null }) {
  const { rows } = await db.query(
    `UPDATE quejas
     SET id_categoria_queja = COALESCE($2, id_categoria_queja),
         id_prioridad_queja = COALESCE($3, id_prioridad_queja),
         id_estado_queja = COALESCE($4, id_estado_queja),
         actualizado_en = CURRENT_TIMESTAMP
     WHERE id_queja = $1
     RETURNING id_categoria_queja, id_prioridad_queja, id_estado_queja, actualizado_en`,
    [idQueja, idCategoria, idPrioridad, idEstado],
  );
  return rows[0];
}

async function insertarAsignacion(db, { idQueja, idResponsable, idAsignador, comentario }) {
  const { rows } = await db.query(
    `INSERT INTO asignaciones_queja (id_queja, id_empleado_responsable, id_empleado_asignador, comentario)
     VALUES ($1, $2, $3, $4)
     RETURNING id_asignacion, asignada_en`,
    [idQueja, idResponsable, idAsignador, comentario],
  );
  return rows[0];
}

async function insertarHistorial(db, { idQueja, idEstadoAnterior, idEstado, idEmpleado }) {
  await db.query(
    `INSERT INTO historiales_estado_queja (id_queja, id_estado_anterior, id_estado_queja, id_empleado_responsable)
     VALUES ($1, $2, $3, $4)`,
    [idQueja, idEstadoAnterior, idEstado, idEmpleado],
  );
}

async function insertarInvolucrado(db, { idQueja, idEmpleado, idRegistrador }) {
  const { rows } = await db.query(
    `INSERT INTO involucrados_queja (id_queja, id_empleado, id_empleado_registrador)
     VALUES ($1, $2, $3)
     RETURNING registrado_en`,
    [idQueja, idEmpleado, idRegistrador],
  );
  return rows[0];
}

async function borrarInvolucrado(db, { idQueja, idEmpleado }) {
  const { rowCount } = await db.query(`DELETE FROM involucrados_queja WHERE id_queja = $1 AND id_empleado = $2`, [
    idQueja,
    idEmpleado,
  ]);
  return rowCount > 0;
}

async function obtenerUltimaAsignacion(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT id_asignacion, id_estado_notificacion FROM asignaciones_queja
     WHERE id_queja = $1
     ORDER BY asignada_en DESC
     LIMIT 1`,
    [idQueja],
  );
  return rows[0] ?? null;
}

async function obtenerDatosAviso(idAsignacion, db = pool) {
  const { rows } = await db.query(
    `SELECT a.id_empleado_responsable, a.asignada_en, q.codigo_seguimiento,
            cq.nombre AS categoria, pq.codigo AS prioridad_codigo, pq.nombre AS prioridad_nombre
     FROM asignaciones_queja a
     JOIN quejas q ON q.id_queja = a.id_queja
     JOIN catalogos_categoria_queja cq ON cq.id_categoria_queja = q.id_categoria_queja
     JOIN catalogos_prioridad_queja pq ON pq.id_prioridad_queja = q.id_prioridad_queja
     WHERE a.id_asignacion = $1`,
    [idAsignacion],
  );
  return rows[0] ?? null;
}

async function registrarNotificacion(idAsignacion, idEstado, db = pool) {
  const { rows } = await db.query(
    `UPDATE asignaciones_queja
     SET id_estado_notificacion = $2::smallint,
         notificada_en = CASE WHEN $2::smallint = 2 THEN CURRENT_TIMESTAMP END
     WHERE id_asignacion = $1
     RETURNING notificada_en`,
    [idAsignacion, idEstado],
  );
  return rows[0] ?? null;
}

module.exports = {
  listarPrioridades,
  listarEstados,
  listarCasos,
  contarCasos,
  obtenerCaso,
  listarAdjuntos,
  listarHistorial,
  listarAsignaciones,
  listarInvolucrados,
  bloquearQueja,
  obtenerResponsableVigente,
  esInvolucrado,
  actualizarQueja,
  insertarAsignacion,
  insertarHistorial,
  insertarInvolucrado,
  borrarInvolucrado,
  obtenerUltimaAsignacion,
  obtenerDatosAviso,
  registrarNotificacion,
};
