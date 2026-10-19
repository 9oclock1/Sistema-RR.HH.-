const pool = require("../config/db");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

// Turno de cada empleado y día: el del rol publicado y, si no hay, la asignación fija vigente.
// `ids` NULL incluye a todos los empleados.
async function listarProgramacion(desde, hasta, ids = null) {
  const { rows } = await pool.query(
    `WITH publicados AS (
       SELECT tp.id_empleado, tp.fecha, tp.es_descanso AS descanso, tp.id_turno, tp.id_rol,
              tp.nombre_turno, tp.hora_inicio, tp.hora_fin,
              COALESCE(tp.minutos_refrigerio, t.minutos_refrigerio) AS minutos_refrigerio,
              COALESCE(tp.minutos_tolerancia, t.minutos_tolerancia) AS minutos_tolerancia
       FROM turnos_publicados tp LEFT JOIN turnos t USING (id_turno)
       WHERE tp.fecha BETWEEN $1 AND $2 AND ($3::uuid[] IS NULL OR tp.id_empleado = ANY($3::uuid[]))
     ),
     fijos AS (
       SELECT DISTINCT ON (a.id_empleado, d.fecha)
              a.id_empleado, d.fecha::date AS fecha, FALSE AS descanso, t.id_turno, NULL::uuid AS id_rol,
              t.nombre AS nombre_turno, t.hora_inicio, t.hora_fin, t.minutos_refrigerio, t.minutos_tolerancia
       FROM asignaciones_turno a
       JOIN turnos t USING (id_turno)
       JOIN generate_series($1::date, $2::date, interval '1 day') AS d(fecha)
         ON d.fecha >= a.fecha_desde AND (a.fecha_hasta IS NULL OR d.fecha <= a.fecha_hasta)
       WHERE t.esta_activo AND ($3::uuid[] IS NULL OR a.id_empleado = ANY($3::uuid[]))
       ORDER BY a.id_empleado, d.fecha, a.fecha_desde DESC, a.creado_en DESC
     )
     SELECT * FROM publicados
     UNION ALL
     SELECT f.* FROM fijos f
     WHERE NOT EXISTS (SELECT 1 FROM publicados p WHERE p.id_empleado = f.id_empleado AND p.fecha = f.fecha)
     ORDER BY id_empleado, fecha`,
    [desde, hasta, ids]
  );
  return rows;
}

// Marcajes de un rango de jornadas, un día antes y uno después (turnos que cruzan la medianoche).
async function listarMarcajes(ids, desde, hasta) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT m.id_marcaje, m.id_empleado, m.fecha_hora_marcaje, m.fecha_jornada,
            t.codigo AS tipo_codigo, e.codigo AS estado_codigo
     FROM marcajes m
     JOIN catalogos_tipo_marcaje t USING (id_tipo_marcaje)
     JOIN catalogos_estado_marcaje e USING (id_estado_marcaje)
     WHERE m.id_empleado = ANY($1::uuid[]) AND m.fecha_jornada BETWEEN $2::date - 1 AND $3::date + 1
     ORDER BY m.fecha_hora_marcaje`,
    [ids, desde, hasta]
  );
  return rows;
}

// Inserta las novedades nuevas; las que ya existen para la jornada y el tipo se dejan como están.
async function registrar(novedades) {
  if (novedades.length === 0) return 0;
  const columna = (campo) => novedades.map((n) => n[campo]);
  const { rowCount } = await pool.query(
    `INSERT INTO novedades_asistencia (id_empleado, fecha_jornada, id_tipo_novedad, id_turno, id_rol, nombre_turno,
                                       inicio_programado, fin_programado, minutos_tolerancia, id_marcaje,
                                       minutos, minutos_penalizacion, minutos_programados)
     SELECT * FROM unnest($1::uuid[], $2::date[], $3::smallint[], $4::uuid[], $5::uuid[], $6::varchar[],
                          $7::timestamptz[], $8::timestamptz[], $9::smallint[], $10::uuid[], $11::int[], $12::int[],
                          $13::int[])
     ON CONFLICT (id_empleado, fecha_jornada, id_tipo_novedad) DO NOTHING`,
    [
      columna("id_empleado"),
      columna("fecha_jornada"),
      columna("id_tipo_novedad"),
      columna("id_turno"),
      columna("id_rol"),
      columna("nombre_turno"),
      columna("inicio_programado"),
      columna("fin_programado"),
      columna("minutos_tolerancia"),
      columna("id_marcaje"),
      columna("minutos"),
      columna("minutos_penalizacion"),
      columna("minutos_programados"),
    ]
  );
  return rowCount;
}

const conCatalogos = `
  SELECT n.id_novedad, n.id_empleado, n.fecha_jornada, n.id_turno, n.id_rol, n.nombre_turno,
         n.inicio_programado, n.fin_programado, n.minutos_tolerancia, n.id_marcaje,
         n.minutos, n.minutos_penalizacion, n.minutos_programados, n.detectada_en, n.consolidada_en,
         t.codigo AS tipo_codigo, t.nombre AS tipo_nombre, e.codigo AS estado_codigo, e.nombre AS estado_nombre
  FROM novedades_asistencia n
  JOIN catalogos_tipo_novedad t USING (id_tipo_novedad)
  JOIN catalogos_estado_novedad e USING (id_estado_novedad)`;

async function listarPorMarcajes(idsMarcajes) {
  const ids = idsMarcajes.filter(Boolean);
  if (ids.length === 0) return [];
  const { rows } = await pool.query(`${conCatalogos} WHERE n.id_marcaje = ANY($1::uuid[]) ORDER BY n.id_tipo_novedad`, [ids]);
  return rows;
}

// Novedades de jornadas cuyo turno terminó hace al menos `minutosCierre`; quedan bloqueadas hasta el fin de la transacción.
async function reservarPorConsolidar(cliente, minutosCierre, limite) {
  const { rows } = await cliente.query(
    `${conCatalogos}
     WHERE n.id_novedad IN (
       SELECT id_novedad FROM novedades_asistencia
       WHERE consolidada_en IS NULL AND fin_programado + make_interval(mins => $1) <= CURRENT_TIMESTAMP
       ORDER BY fin_programado
       LIMIT $2
       FOR UPDATE SKIP LOCKED
     )
     ORDER BY n.id_empleado, n.fecha_jornada, n.id_tipo_novedad`,
    [minutosCierre, limite]
  );
  return rows;
}

async function marcarConsolidadas(cliente, ids) {
  await cliente.query(
    "UPDATE novedades_asistencia SET consolidada_en = CURRENT_TIMESTAMP WHERE id_novedad = ANY($1::uuid[])",
    [ids]
  );
}

// Minutos de atraso registrados en el mes de `fecha`, hasta ese día.
async function sumarAtrasosDelMes(ids, fecha) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT n.id_empleado, SUM(n.minutos)::int AS minutos, COUNT(*)::int AS cantidad
     FROM novedades_asistencia n
     WHERE n.id_empleado = ANY($1::uuid[]) AND n.id_tipo_novedad = 1 AND n.id_estado_novedad = 1
       AND n.fecha_jornada BETWEEN date_trunc('month', $2::date)::date AND $2::date
     GROUP BY n.id_empleado`,
    [ids, fecha]
  );
  return rows;
}

// Tipos de novedad ya justificados de cada empleado en una jornada.
async function listarJustificadas(ids, fecha) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT n.id_empleado, t.codigo AS tipo_codigo
     FROM novedades_asistencia n
     JOIN catalogos_tipo_novedad t USING (id_tipo_novedad)
     WHERE n.id_empleado = ANY($1::uuid[]) AND n.fecha_jornada = $2::date AND n.id_estado_novedad = 2`,
    [ids, fecha]
  );
  return rows;
}

async function momentoActual() {
  const { rows } = await pool.query(`SELECT CURRENT_TIMESTAMP AS ahora, ${HOY_BOLIVIA} AS hoy`);
  return rows[0];
}

module.exports = {
  listarProgramacion,
  listarMarcajes,
  registrar,
  listarPorMarcajes,
  reservarPorConsolidar,
  marcarConsolidadas,
  sumarAtrasosDelMes,
  listarJustificadas,
  momentoActual,
};
