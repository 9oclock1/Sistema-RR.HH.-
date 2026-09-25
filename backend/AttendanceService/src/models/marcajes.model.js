const pool = require("../config/db");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

const conCatalogos = (origen) => `
  SELECT m.id_marcaje, m.id_empleado, m.fecha_hora_marcaje, m.fecha_jornada, m.codigo_dispositivo,
         t.codigo AS tipo_codigo, o.codigo AS origen_codigo, o.nombre AS origen_nombre,
         e.codigo AS estado_codigo, e.nombre AS estado_nombre
  FROM ${origen} m
  JOIN catalogos_tipo_marcaje t USING (id_tipo_marcaje)
  JOIN catalogos_origen_marcaje o USING (id_origen_marcaje)
  JOIN catalogos_estado_marcaje e USING (id_estado_marcaje)`;

async function registrar({ idEmpleado, idTipo, idOrigen, idEstado, codigoDispositivo = null, fechaJornada = null }) {
  const { rows } = await pool.query(
    `WITH nuevo AS (
       INSERT INTO marcajes (id_empleado, id_tipo_marcaje, id_origen_marcaje, id_estado_marcaje, fecha_jornada, codigo_dispositivo)
       VALUES ($1, $2, $3, $4, COALESCE($6::date, ${HOY_BOLIVIA}), $5)
       RETURNING *
     ) ${conCatalogos("nuevo")}`,
    [idEmpleado, idTipo, idOrigen, idEstado, codigoDispositivo, fechaJornada]
  );
  return rows[0];
}

// Marcajes de la jornada de hoy y de la anterior.
async function listarRecientes(idEmpleado, hoy) {
  const { rows } = await pool.query(
    `${conCatalogos("marcajes")}
     WHERE m.id_empleado = $1 AND m.fecha_jornada >= $2::date - 1
     ORDER BY m.fecha_hora_marcaje`,
    [idEmpleado, hoy]
  );
  return rows;
}

async function momentoActual() {
  const { rows } = await pool.query(`SELECT CURRENT_TIMESTAMP AS ahora, ${HOY_BOLIVIA} AS hoy`);
  return rows[0];
}

module.exports = { registrar, listarRecientes, momentoActual };
