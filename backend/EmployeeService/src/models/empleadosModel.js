const bloquearPorId = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT id_empleado, fecha_ingreso, id_cargo_actual, id_sucursal_actual
       FROM empleados
      WHERE id_empleado = $1
        FOR UPDATE`,
    [idEmpleado]
  );
  return rows[0] || null;
};

const actualizarAsignacionActual = async (db, idEmpleado, { id_cargo, id_sucursal }) => {
  await db.query(
    `UPDATE empleados
        SET id_cargo_actual = $1,
            id_sucursal_actual = $2,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_empleado = $3`,
    [id_cargo, id_sucursal, idEmpleado]
  );
};

module.exports = { bloquearPorId, actualizarAsignacionActual };
