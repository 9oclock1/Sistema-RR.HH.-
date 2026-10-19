const pool = require("../config/db");

async function listarJornadas(idEmpleado, desde, hasta) {
  const { rows } = await pool.query(
    `WITH marcas AS (
       SELECT fecha_jornada,
              MIN(fecha_hora_marcaje) FILTER (WHERE id_tipo_marcaje = 1) AS entrada_en,
              MAX(fecha_hora_marcaje) FILTER (WHERE id_tipo_marcaje = 2) AS salida_en
         FROM marcajes
        WHERE id_empleado = $1 AND fecha_jornada BETWEEN $2 AND $3
        GROUP BY fecha_jornada
     ),
     novedades AS (
       SELECT n.fecha_jornada,
              MIN(n.nombre_turno) AS nombre_turno,
              json_agg(
                json_build_object('tipo', t.codigo, 'nombre', t.nombre, 'minutos', n.minutos, 'estado', e.codigo)
                ORDER BY n.id_tipo_novedad
              ) AS novedades
         FROM novedades_asistencia n
         JOIN catalogos_tipo_novedad t ON t.id_tipo_novedad = n.id_tipo_novedad
         JOIN catalogos_estado_novedad e ON e.id_estado_novedad = n.id_estado_novedad
        WHERE n.id_empleado = $1 AND n.fecha_jornada BETWEEN $2 AND $3
        GROUP BY n.fecha_jornada
     ),
     fechas AS (
       SELECT fecha_jornada FROM marcas
       UNION
       SELECT fecha_jornada FROM novedades
     )
     SELECT f.fecha_jornada,
            COALESCE(h.nombre_turno, nv.nombre_turno) AS turno,
            m.entrada_en,
            m.salida_en,
            h.minutos_trabajados,
            h.minutos_extra,
            COALESCE(nv.novedades, '[]'::json) AS novedades
       FROM fechas f
       LEFT JOIN marcas m ON m.fecha_jornada = f.fecha_jornada
       LEFT JOIN novedades nv ON nv.fecha_jornada = f.fecha_jornada
       LEFT JOIN horas_jornada h ON h.id_empleado = $1 AND h.fecha_jornada = f.fecha_jornada
      ORDER BY f.fecha_jornada DESC`,
    [idEmpleado, desde, hasta]
  );
  return rows;
}

module.exports = { listarJornadas };
