const pool = require("../config/db");
const { SIN_ID } = require("../utils/calendarioAusencias");

// KAN-55: una sola consulta trae vacaciones y licencias aprobadas del personal que se cruzan con el rango.
// Usa los índices parciales de ausencias activas (fechas) y no recorre empleado por empleado.
async function listarAprobadas(idsEmpleados, desde, hasta) {
  if (idsEmpleados.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT 'VACACIONES' AS categoria, s.id_solicitud, s.id_empleado, 'VACACIONES' AS tipo_codigo,
            'Vacaciones' AS tipo_nombre, s.fecha_inicio, s.fecha_fin, s.dias_habiles AS dias,
            TRUE AS es_con_goce_haberes
       FROM solicitudes_vacacion s
      WHERE s.id_estado_solicitud = 2 AND s.id_empleado = ANY($1::uuid[])
        AND s.fecha_inicio <= $3 AND s.fecha_fin >= $2
     UNION ALL
     SELECT 'LICENCIA', s.id_solicitud, s.id_empleado, t.codigo, t.nombre, s.fecha_inicio, s.fecha_fin,
            s.dias_solicitados, s.es_con_goce_haberes
       FROM solicitudes_licencia s
       JOIN catalogos_tipo_licencia t USING (id_tipo_licencia)
      WHERE s.id_estado_solicitud = 2 AND s.id_empleado = ANY($1::uuid[])
        AND s.fecha_inicio <= $3 AND s.fecha_fin >= $2
     ORDER BY fecha_inicio, id_empleado`,
    [idsEmpleados, desde, hasta]
  );
  return rows;
}

// Días de trabajo y de descanso publicados en el rol: definen quién debía trabajar cada día.
async function listarTurnos(idsEmpleados, desde, hasta) {
  if (idsEmpleados.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id_empleado, fecha, es_descanso FROM turnos_publicados
      WHERE id_empleado = ANY($1::uuid[]) AND fecha BETWEEN $2 AND $3`,
    [idsEmpleados, desde, hasta]
  );
  return rows;
}

async function listarFeriados(desde, hasta) {
  const { rows } = await pool.query("SELECT fecha, nombre FROM feriados WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha", [desde, hasta]);
  return rows;
}

async function hoy() {
  const { rows } = await pool.query("SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date AS hoy");
  return rows[0].hoy;
}

const COLUMNAS_UMBRAL = "id_umbral, id_sucursal, id_departamento, max_ausentes_porcentaje, min_presentes, actualizado_por, actualizado_en";

async function listarUmbrales() {
  const { rows } = await pool.query(`SELECT ${COLUMNAS_UMBRAL} FROM umbrales_cobertura ORDER BY id_sucursal NULLS FIRST, id_departamento NULLS FIRST`);
  return rows;
}

// Un umbral por alcance (sucursal y área, cualquiera de las dos o ninguna): guardar de nuevo lo reemplaza.
async function guardarUmbral({ idSucursal, idDepartamento, maxAusentesPorcentaje, minPresentes, idEmpleado }) {
  const { rows } = await pool.query(
    `INSERT INTO umbrales_cobertura (id_sucursal, id_departamento, max_ausentes_porcentaje, min_presentes, actualizado_por)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (COALESCE(id_sucursal, '${SIN_ID}'::uuid), COALESCE(id_departamento, '${SIN_ID}'::uuid))
     DO UPDATE SET max_ausentes_porcentaje = EXCLUDED.max_ausentes_porcentaje, min_presentes = EXCLUDED.min_presentes,
                   actualizado_por = EXCLUDED.actualizado_por, actualizado_en = CURRENT_TIMESTAMP
     RETURNING ${COLUMNAS_UMBRAL}`,
    [idSucursal, idDepartamento, maxAusentesPorcentaje, minPresentes, idEmpleado]
  );
  return rows[0];
}

async function eliminarUmbral(idUmbral) {
  const { rowCount } = await pool.query("DELETE FROM umbrales_cobertura WHERE id_umbral = $1", [idUmbral]);
  return rowCount === 1;
}

module.exports = { listarAprobadas, listarTurnos, listarFeriados, hoy, listarUmbrales, guardarUmbral, eliminarUmbral };
