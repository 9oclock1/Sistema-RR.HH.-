const pool = require("../config/db");

// RF-28: historial de asistencia de un solo colaborador. Todas las consultas filtran por su id.

async function listarMarcajes(idEmpleado, desde, hasta) {
  const { rows } = await pool.query(
    `SELECT m.id_marcaje, m.fecha_jornada, m.fecha_hora_marcaje, m.codigo_dispositivo,
            t.codigo AS tipo_codigo, o.codigo AS origen_codigo, o.nombre AS origen_nombre,
            e.codigo AS estado_codigo, e.nombre AS estado_nombre
     FROM marcajes m
     JOIN catalogos_tipo_marcaje t USING (id_tipo_marcaje)
     JOIN catalogos_origen_marcaje o USING (id_origen_marcaje)
     JOIN catalogos_estado_marcaje e USING (id_estado_marcaje)
     WHERE m.id_empleado = $1 AND m.fecha_jornada BETWEEN $2 AND $3
     ORDER BY m.fecha_hora_marcaje`,
    [idEmpleado, desde, hasta]
  );
  return rows;
}

// Todas las novedades (también la omisión de salida, que no se justifica).
async function listarNovedades(idEmpleado, desde, hasta) {
  const { rows } = await pool.query(
    `SELECT n.id_novedad, n.fecha_jornada, n.minutos, n.nombre_turno, n.inicio_programado, n.fin_programado,
            t.codigo AS tipo_codigo, t.nombre AS tipo_nombre, t.es_justificable,
            e.codigo AS estado_codigo, e.nombre AS estado_nombre
     FROM novedades_asistencia n
     JOIN catalogos_tipo_novedad t USING (id_tipo_novedad)
     JOIN catalogos_estado_novedad e USING (id_estado_novedad)
     WHERE n.id_empleado = $1 AND n.fecha_jornada BETWEEN $2 AND $3
     ORDER BY n.fecha_jornada, n.id_tipo_novedad`,
    [idEmpleado, desde, hasta]
  );
  return rows;
}

// Horas computadas de cada jornada cerrada: el tiempo ordinario del turno (sin refrigerio) más las horas extra aprobadas.
// Sin turno (descanso o día libre) cuenta lo aprobado como jornada del día más sus extra; no el tiempo bruto entre marcajes.
async function listarHoras(idEmpleado, desde, hasta) {
  const { rows } = await pool.query(
    `SELECT h.fecha_jornada, h.minutos_ordinarios,
            (h.minutos_ordinarios + h.minutos_extra_habil + h.minutos_extra_domingo + h.minutos_extra_feriado
             + CASE WHEN h.inicio_programado IS NULL THEN h.minutos_descanso + h.minutos_domingo + h.minutos_feriado ELSE 0 END
            )::int AS minutos_computados,
            (h.minutos_extra_habil + h.minutos_extra_domingo + h.minutos_extra_feriado)::int AS minutos_extra_aprobados,
            e.codigo AS estado_extra_codigo, e.nombre AS estado_extra_nombre
     FROM horas_jornada h
     JOIN catalogos_estado_horas_extra e USING (id_estado_horas_extra)
     WHERE h.id_empleado = $1 AND h.fecha_jornada BETWEEN $2 AND $3`,
    [idEmpleado, desde, hasta]
  );
  return rows;
}

// Licencias y permisos que tocan el rango; las canceladas por el propio colaborador no se muestran.
async function listarLicencias(idEmpleado, desde, hasta) {
  const { rows } = await pool.query(
    `SELECT s.id_solicitud, s.fecha_inicio, s.fecha_fin, s.motivo_resolucion, s.resuelto_en, s.creado_en,
            t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
            e.codigo AS estado_codigo, e.nombre AS estado_nombre
     FROM solicitudes_licencia s
     JOIN catalogos_tipo_licencia t USING (id_tipo_licencia)
     JOIN catalogos_estado_solicitud e USING (id_estado_solicitud)
     WHERE s.id_empleado = $1 AND s.fecha_inicio <= $3 AND s.fecha_fin >= $2 AND e.codigo <> 'CANCELADA'
     ORDER BY s.creado_en DESC`,
    [idEmpleado, desde, hasta]
  );
  return rows;
}

module.exports = { listarMarcajes, listarNovedades, listarHoras, listarLicencias };
