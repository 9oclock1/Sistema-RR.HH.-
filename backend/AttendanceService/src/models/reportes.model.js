const pool = require("../config/db");

// RF-29: totales de novedades por empleado en el rango. Estado 1 = registrada (sin justificar), 2 = justificada.
// Tipos: 1 atraso, 2 inasistencia, 3 salida anticipada, 4 omisión de salida (ver CATALOGOS_TIPO_NOVEDAD).
async function totalizarNovedades(ids, desde, hasta) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id_empleado,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 1 AND id_estado_novedad = 1)::int AS atrasos,
            COALESCE(SUM(minutos) FILTER (WHERE id_tipo_novedad = 1 AND id_estado_novedad = 1), 0)::int AS minutos_retraso,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 1 AND id_estado_novedad = 2)::int AS atrasos_justificados,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 2 AND id_estado_novedad = 1)::int AS faltas_injustificadas,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 2 AND id_estado_novedad = 2)::int AS faltas_justificadas,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 3 AND id_estado_novedad = 1)::int AS salidas_anticipadas,
            COUNT(*) FILTER (WHERE id_tipo_novedad = 4)::int AS omisiones_salida
     FROM novedades_asistencia
     WHERE id_empleado = ANY($1::uuid[]) AND fecha_jornada BETWEEN $2 AND $3
     GROUP BY id_empleado`,
    [ids, desde, hasta]
  );
  return rows;
}

// Horas extra aprobadas (lo que se paga, separado por tipo de día) y jornadas que aún esperan revisión.
async function totalizarHorasExtra(ids, desde, hasta) {
  if (ids.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id_empleado,
            SUM(minutos_extra_habil + minutos_extra_domingo + minutos_extra_feriado)::int AS minutos_extra,
            COUNT(*) FILTER (WHERE id_estado_horas_extra = 2)::int AS extra_por_revisar
     FROM horas_jornada
     WHERE id_empleado = ANY($1::uuid[]) AND fecha_jornada BETWEEN $2 AND $3
     GROUP BY id_empleado`,
    [ids, desde, hasta]
  );
  return rows;
}

module.exports = { totalizarNovedades, totalizarHorasExtra };
