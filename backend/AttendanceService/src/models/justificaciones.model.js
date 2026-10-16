const pool = require("../config/db");

const NOVEDAD = `
  SELECT n.id_novedad, n.id_empleado, n.fecha_jornada, n.nombre_turno, n.inicio_programado, n.fin_programado,
         n.minutos_tolerancia, n.minutos, n.minutos_penalizacion, n.minutos_programados, n.consolidada_en,
         n.id_marcaje, m.fecha_hora_marcaje,
         t.codigo AS tipo_codigo, t.nombre AS tipo_nombre, t.es_justificable,
         e.codigo AS estado_codigo, e.nombre AS estado_nombre
  FROM novedades_asistencia n
  JOIN catalogos_tipo_novedad t USING (id_tipo_novedad)
  JOIN catalogos_estado_novedad e USING (id_estado_novedad)
  LEFT JOIN marcajes m ON m.id_marcaje = n.id_marcaje`;

const SOLICITUD = `
  SELECT s.id_solicitud, s.id_novedad, s.id_empleado, s.descripcion, s.id_revisor, s.nombre_revisor,
         s.comentario_revision, s.revisada_en, s.creado_en,
         mo.id_motivo_justificacion, mo.codigo AS motivo_codigo, mo.nombre AS motivo_nombre,
         es.codigo AS estado_codigo, es.nombre AS estado_nombre
  FROM solicitudes_justificacion s
  JOIN catalogos_motivo_justificacion mo USING (id_motivo_justificacion)
  JOIN catalogos_estado_justificacion es USING (id_estado_justificacion)`;

async function listarMotivos() {
  const { rows } = await pool.query(
    "SELECT id_motivo_justificacion, codigo, nombre FROM catalogos_motivo_justificacion ORDER BY id_motivo_justificacion"
  );
  return rows;
}

// Se bloquea solo la fila y después se lee con sus catálogos: si otra transacción cambia el estado mientras se espera,
// la consulta con joins la descartaría en lugar de devolver el estado nuevo.
async function bloquear(cliente, tabla, columna, id) {
  const { rowCount } = await cliente.query(`SELECT 1 FROM ${tabla} WHERE ${columna} = $1 FOR UPDATE`, [id]);
  return rowCount > 0;
}

// Novedad del empleado, bloqueada hasta el fin de la transacción para que no se presenten dos solicitudes a la vez.
async function bloquearNovedadDelEmpleado(cliente, idNovedad, idEmpleado) {
  if (!(await bloquear(cliente, "novedades_asistencia", "id_novedad", idNovedad))) return null;
  const { rows } = await cliente.query(`${NOVEDAD} WHERE n.id_novedad = $1 AND n.id_empleado = $2`, [idNovedad, idEmpleado]);
  return rows[0] ?? null;
}

// Solicitud pendiente o aprobada de la novedad (a lo sumo una).
async function obtenerVigente(db, idNovedad) {
  const { rows } = await db.query(`${SOLICITUD} WHERE s.id_novedad = $1 AND s.id_estado_justificacion IN (1, 2)`, [
    idNovedad,
  ]);
  return rows[0] ?? null;
}

async function crear(cliente, { idNovedad, idEmpleado, idMotivo, descripcion }) {
  const { rows } = await cliente.query(
    `INSERT INTO solicitudes_justificacion (id_novedad, id_empleado, id_motivo_justificacion, descripcion)
     VALUES ($1, $2, $3, $4)
     RETURNING id_solicitud`,
    [idNovedad, idEmpleado, idMotivo, descripcion]
  );
  return rows[0].id_solicitud;
}

async function agregarAdjuntos(cliente, idSolicitud, adjuntos) {
  const columna = (campo) => adjuntos.map((a) => a[campo]);
  await cliente.query(
    `INSERT INTO adjuntos_justificacion (id_solicitud, nombre_original, tipo_mime, tamano_bytes, clave_almacenamiento)
     SELECT $1::uuid, * FROM unnest($2::varchar[], $3::varchar[], $4::int[], $5::varchar[])`,
    [idSolicitud, columna("nombre_original"), columna("tipo_mime"), columna("tamano_bytes"), columna("clave_almacenamiento")]
  );
}

async function obtener(db, idSolicitud) {
  const { rows } = await db.query(`${SOLICITUD} WHERE s.id_solicitud = $1`, [idSolicitud]);
  return rows[0] ?? null;
}

async function obtenerNovedad(db, idNovedad) {
  const { rows } = await db.query(`${NOVEDAD} WHERE n.id_novedad = $1`, [idNovedad]);
  return rows[0] ?? null;
}

async function listarAdjuntos(db, idsSolicitudes) {
  if (idsSolicitudes.length === 0) return [];
  const { rows } = await db.query(
    `SELECT id_adjunto, id_solicitud, nombre_original, tipo_mime, tamano_bytes, creado_en
     FROM adjuntos_justificacion
     WHERE id_solicitud = ANY($1::uuid[])
     ORDER BY creado_en, nombre_original`,
    [idsSolicitudes]
  );
  return rows;
}

// Novedades justificables del empleado en un rango de jornadas, con su última solicitud.
async function listarNovedadesDelEmpleado(idEmpleado, desde, hasta) {
  const { rows } = await pool.query(
    `${NOVEDAD}
     WHERE n.id_empleado = $1 AND n.fecha_jornada BETWEEN $2 AND $3 AND t.es_justificable
     ORDER BY n.fecha_jornada DESC, n.id_tipo_novedad`,
    [idEmpleado, desde, hasta]
  );
  return rows;
}

// Solicitudes de varias novedades, de la más reciente a la más antigua.
async function listarPorNovedades(idsNovedades) {
  if (idsNovedades.length === 0) return [];
  const { rows } = await pool.query(
    `${SOLICITUD} WHERE s.id_novedad = ANY($1::uuid[]) ORDER BY s.creado_en DESC`,
    [idsNovedades]
  );
  return rows;
}

module.exports = {
  listarMotivos,
  bloquearNovedadDelEmpleado,
  obtenerVigente,
  crear,
  agregarAdjuntos,
  obtener,
  obtenerNovedad,
  listarAdjuntos,
  listarNovedadesDelEmpleado,
  listarPorNovedades,
};
