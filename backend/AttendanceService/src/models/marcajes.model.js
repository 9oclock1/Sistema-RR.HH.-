const pool = require("../config/db");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

const conCatalogos = (origen) => `
  SELECT m.id_marcaje, m.id_empleado, m.fecha_hora_marcaje, m.fecha_jornada, m.codigo_dispositivo,
         t.codigo AS tipo_codigo, o.codigo AS origen_codigo, o.nombre AS origen_nombre
  FROM ${origen} m
  JOIN catalogos_tipo_marcaje t USING (id_tipo_marcaje)
  JOIN catalogos_origen_marcaje o USING (id_origen_marcaje)`;

async function registrar({ idEmpleado, idTipo, idOrigen, codigoDispositivo = null }) {
  const { rows } = await pool.query(
    `WITH nuevo AS (
       INSERT INTO marcajes (id_empleado, id_tipo_marcaje, id_origen_marcaje, fecha_jornada, codigo_dispositivo)
       VALUES ($1, $2, $3, ${HOY_BOLIVIA}, $4)
       RETURNING *
     ) ${conCatalogos("nuevo")}`,
    [idEmpleado, idTipo, idOrigen, codigoDispositivo]
  );
  return rows[0];
}

async function listarDeHoy(idEmpleado) {
  const { rows } = await pool.query(
    `${conCatalogos("marcajes")}
     WHERE m.id_empleado = $1 AND m.fecha_jornada = ${HOY_BOLIVIA}
     ORDER BY m.fecha_hora_marcaje`,
    [idEmpleado]
  );
  return rows;
}

async function fechaJornadaActual() {
  const { rows } = await pool.query(`SELECT ${HOY_BOLIVIA} AS fecha`);
  return rows[0].fecha;
}

module.exports = { registrar, listarDeHoy, fechaJornadaActual };
