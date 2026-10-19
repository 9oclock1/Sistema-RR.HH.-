const pool = require("../config/db");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

const conEstado = (origen) => `
  SELECT s.id_solicitud, s.id_empleado, s.fecha_inicio, s.fecha_fin, s.dias_habiles,
         s.id_supervisor, s.supervisor_notificado, s.creado_en,
         c.codigo AS estado_codigo, c.nombre AS estado_nombre
  FROM ${origen} s
  JOIN catalogos_estado_solicitud_vacacion c USING (id_estado_solicitud)`;

async function hoy(db = pool) {
  const { rows } = await db.query(`SELECT ${HOY_BOLIVIA} AS hoy`);
  return rows[0].hoy;
}

async function listarFeriados(fechaInicio, fechaFin, db = pool) {
  const { rows } = await db.query(
    "SELECT fecha, nombre FROM feriados WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha",
    [fechaInicio, fechaFin]
  );
  return rows;
}

async function listarPorEmpleado(idEmpleado, db = pool) {
  const { rows } = await db.query(
    `${conEstado("solicitudes_vacacion")} WHERE s.id_empleado = $1 ORDER BY s.fecha_inicio DESC`,
    [idEmpleado]
  );
  return rows;
}

async function sumarDiasEnCurso(idEmpleado, estados, db = pool) {
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(dias_habiles), 0)::int AS total
     FROM solicitudes_vacacion WHERE id_empleado = $1 AND id_estado_solicitud = ANY($2)`,
    [idEmpleado, estados]
  );
  return rows[0].total;
}

async function listarSolapadas(idEmpleado, fechaInicio, fechaFin, estados, db = pool) {
  const { rows } = await db.query(
    `${conEstado("solicitudes_vacacion")}
     WHERE s.id_empleado = $1 AND s.id_estado_solicitud = ANY($4)
       AND s.fecha_inicio <= $3 AND s.fecha_fin >= $2
     ORDER BY s.fecha_inicio`,
    [idEmpleado, fechaInicio, fechaFin, estados]
  );
  return rows;
}

async function registrar({ idEmpleado, fechaInicio, fechaFin, diasHabiles, idSupervisor }, db = pool) {
  const { rows } = await db.query(
    `WITH nueva AS (
       INSERT INTO solicitudes_vacacion (id_empleado, fecha_inicio, fecha_fin, dias_habiles, id_supervisor)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     ) ${conEstado("nueva")}`,
    [idEmpleado, fechaInicio, fechaFin, diasHabiles, idSupervisor]
  );
  return rows[0];
}

async function marcarNotificada(idSolicitud, db = pool) {
  await db.query(
    "UPDATE solicitudes_vacacion SET supervisor_notificado = TRUE, actualizado_en = CURRENT_TIMESTAMP WHERE id_solicitud = $1",
    [idSolicitud]
  );
}

// Ejecuta en una transacción bloqueando al empleado, para que dos envíos simultáneos no superen el saldo ni se solapen.
async function enTransaccionDeEmpleado(idEmpleado, trabajo) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    await cliente.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`vacaciones:${idEmpleado}`]);
    const resultado = await trabajo(cliente);
    await cliente.query("COMMIT");
    return resultado;
  } catch (error) {
    await cliente.query("ROLLBACK");
    throw error;
  } finally {
    cliente.release();
  }
}

module.exports = {
  hoy,
  listarFeriados,
  listarPorEmpleado,
  sumarDiasEnCurso,
  listarSolapadas,
  registrar,
  marcarNotificada,
  enTransaccionDeEmpleado,
};
