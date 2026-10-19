const pool = require("../config/db");

// Los cancelados no afectan el saldo ni forman parte del historial de consumo.
async function listarMovimientos(idEmpleado) {
  const { rows } = await pool.query(
    `SELECT m.id_movimiento, m.id_estado_movimiento, e.codigo AS estado_codigo, e.nombre AS estado_nombre,
            m.fecha_inicio, m.fecha_fin, m.dias, m.creado_en
     FROM movimientos_vacacion m
     JOIN catalogos_estado_movimiento_vacacion e USING (id_estado_movimiento)
     WHERE m.id_empleado = $1 AND m.id_estado_movimiento <> 3
     ORDER BY m.fecha_inicio DESC, m.creado_en DESC`,
    [idEmpleado]
  );
  return rows;
}

module.exports = { listarMovimientos };
