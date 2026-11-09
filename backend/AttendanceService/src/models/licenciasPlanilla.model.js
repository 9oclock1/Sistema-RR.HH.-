const pool = require("../config/db");

// Licencias aprobadas de todo el personal que se cruzan con el rango.
async function listarAprobadas(desde, hasta) {
  const { rows } = await pool.query(
    `SELECT s.id_solicitud, s.id_empleado, t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
            s.fecha_inicio, s.fecha_fin, s.es_con_goce_haberes
       FROM solicitudes_licencia s
       JOIN catalogos_tipo_licencia t USING (id_tipo_licencia)
      WHERE s.id_estado_solicitud = 2 AND s.fecha_inicio <= $2 AND s.fecha_fin >= $1
      ORDER BY s.id_empleado, s.fecha_inicio`,
    [desde, hasta]
  );
  return rows;
}

module.exports = { listarAprobadas };
