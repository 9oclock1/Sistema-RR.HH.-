const pool = require("../config/db");

const conTipo = (origen) => `
  SELECT t.*, c.codigo AS tipo_codigo, c.nombre AS tipo_nombre
  FROM ${origen} t JOIN catalogos_tipo_jornada c USING (id_tipo_jornada)`;

const valores = (t) => [
  t.nombre,
  t.id_tipo_jornada,
  t.hora_inicio,
  t.hora_fin,
  t.minutos_refrigerio,
  t.minutos_tolerancia,
  t.esta_activo,
];

async function listar(activo) {
  const filtro = activo === undefined ? "" : "WHERE t.esta_activo = $1";
  const params = activo === undefined ? [] : [activo];
  const { rows } = await pool.query(
    `${conTipo("turnos")} ${filtro} ORDER BY t.hora_inicio, t.nombre`,
    params
  );
  return rows;
}

async function obtener(id) {
  const { rows } = await pool.query(`${conTipo("turnos")} WHERE t.id_turno = $1`, [id]);
  return rows[0];
}

async function crear(turno) {
  const { rows } = await pool.query(
    `WITH nuevo AS (
       INSERT INTO turnos (nombre, id_tipo_jornada, hora_inicio, hora_fin,
                           minutos_refrigerio, minutos_tolerancia, esta_activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *
     ) ${conTipo("nuevo")}`,
    valores(turno)
  );
  return rows[0];
}

async function actualizar(id, turno) {
  const { rows } = await pool.query(
    `WITH editado AS (
       UPDATE turnos SET nombre = $1, id_tipo_jornada = $2, hora_inicio = $3, hora_fin = $4,
                         minutos_refrigerio = $5, minutos_tolerancia = $6, esta_activo = $7,
                         actualizado_en = CURRENT_TIMESTAMP
       WHERE id_turno = $8
       RETURNING *
     ) ${conTipo("editado")}`,
    [...valores(turno), id]
  );
  return rows[0];
}

async function eliminar(id) {
  const { rowCount } = await pool.query("DELETE FROM turnos WHERE id_turno = $1", [id]);
  return rowCount;
}

async function contarEmpleadosAsignados(id) {
  const { rows } = await pool.query(
    "SELECT COUNT(DISTINCT id_empleado)::int AS total FROM asignaciones_turno WHERE id_turno = $1",
    [id]
  );
  return rows[0].total;
}

async function listarTiposJornada() {
  const { rows } = await pool.query(
    "SELECT id_tipo_jornada, codigo, nombre FROM catalogos_tipo_jornada ORDER BY id_tipo_jornada"
  );
  return rows;
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
  contarEmpleadosAsignados,
  listarTiposJornada,
};
