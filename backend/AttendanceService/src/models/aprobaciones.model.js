const pool = require("../config/db");

// Bandeja de aprobaciones (KAN-53): lee las dos clases de ausencia (vacaciones y licencias) de un grupo de empleados.
// estado: código del catálogo (PENDIENTE, APROBADA, RECHAZADA) o null para todos.

const VACACIONES = `
  SELECT 'VACACIONES' AS categoria, s.id_solicitud, s.id_empleado, 'Vacaciones' AS tipo_nombre,
         s.fecha_inicio, s.fecha_fin, s.dias_habiles AS dias, NULL::boolean AS es_con_goce_haberes,
         FALSE AS excede_limite_dias, s.creado_en, s.resuelto_en, s.motivo_resolucion,
         c.codigo AS estado_codigo, c.nombre AS estado_nombre
  FROM solicitudes_vacacion s JOIN catalogos_estado_solicitud c USING (id_estado_solicitud)
  WHERE s.id_empleado = ANY($1::uuid[]) AND ($2::text IS NULL OR c.codigo = $2)`;

const LICENCIAS = `
  SELECT 'LICENCIA' AS categoria, s.id_solicitud, s.id_empleado, t.nombre AS tipo_nombre,
         s.fecha_inicio, s.fecha_fin, s.dias_solicitados AS dias, s.es_con_goce_haberes,
         s.excede_limite_dias, s.creado_en, s.resuelto_en, s.motivo_resolucion,
         c.codigo AS estado_codigo, c.nombre AS estado_nombre
  FROM solicitudes_licencia s
  JOIN catalogos_tipo_licencia t USING (id_tipo_licencia)
  JOIN catalogos_estado_solicitud c USING (id_estado_solicitud)
  WHERE s.id_empleado = ANY($1::uuid[]) AND ($2::text IS NULL OR c.codigo = $2)`;

async function listar(idsEmpleados, estado, limite) {
  const { rows } = await pool.query(
    `SELECT * FROM (${VACACIONES} UNION ALL ${LICENCIAS}) AS ausencias
     ORDER BY (estado_codigo = 'PENDIENTE') DESC,
              CASE WHEN estado_codigo = 'PENDIENTE' THEN fecha_inicio END,
              resuelto_en DESC NULLS LAST, creado_en
     LIMIT $3`,
    [idsEmpleados, estado, limite]
  );
  return rows;
}

// Cuántas solicitudes hay en cada estado, para los contadores de las pestañas.
async function contarPorEstado(idsEmpleados) {
  const { rows } = await pool.query(
    `SELECT codigo, SUM(total)::int AS total FROM (
       SELECT c.codigo, COUNT(*) AS total FROM solicitudes_vacacion s
         JOIN catalogos_estado_solicitud c USING (id_estado_solicitud) WHERE s.id_empleado = ANY($1::uuid[]) GROUP BY c.codigo
       UNION ALL
       SELECT c.codigo, COUNT(*) FROM solicitudes_licencia s
         JOIN catalogos_estado_solicitud c USING (id_estado_solicitud) WHERE s.id_empleado = ANY($1::uuid[]) GROUP BY c.codigo
     ) conteo GROUP BY codigo`,
    [idsEmpleados]
  );
  return Object.fromEntries(rows.map((fila) => [fila.codigo, fila.total]));
}

// Ausencias pendientes o aprobadas de los compañeros que se cruzan con el rango (impacto de cobertura).
async function listarAusenciasSolapadas(idsEmpleados, fechaInicio, fechaFin, excluirSolicitud) {
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT 'VACACIONES' AS categoria, s.id_solicitud, s.id_empleado, 'Vacaciones' AS tipo_nombre,
              s.fecha_inicio, s.fecha_fin, c.codigo AS estado_codigo
       FROM solicitudes_vacacion s JOIN catalogos_estado_solicitud c USING (id_estado_solicitud)
       UNION ALL
       SELECT 'LICENCIA', s.id_solicitud, s.id_empleado, t.nombre, s.fecha_inicio, s.fecha_fin, c.codigo
       FROM solicitudes_licencia s
       JOIN catalogos_tipo_licencia t USING (id_tipo_licencia)
       JOIN catalogos_estado_solicitud c USING (id_estado_solicitud)
     ) ausencias
     WHERE id_empleado = ANY($1::uuid[]) AND estado_codigo IN ('PENDIENTE', 'APROBADA')
       AND fecha_inicio <= $3 AND fecha_fin >= $2 AND id_solicitud <> $4::uuid
     ORDER BY fecha_inicio`,
    [idsEmpleados, fechaInicio, fechaFin, excluirSolicitud]
  );
  return rows;
}

module.exports = { listar, contarPorEstado, listarAusenciasSolapadas };
