const NOMBRE_COMPLETO = `concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido)`;

const listar = async (db) => {
  const { rows } = await db.query(
    `SELECT e.id_empleado,
            ${NOMBRE_COMPLETO} AS nombre_completo,
            e.numero_documento,
            c.nombre AS cargo,
            s.nombre AS sucursal
       FROM empleados e
       JOIN cargos c     ON c.id_cargo = e.id_cargo_actual
       JOIN sucursales s ON s.id_sucursal = e.id_sucursal_actual
      ORDER BY e.primer_apellido ASC, e.segundo_apellido ASC NULLS FIRST, e.nombres ASC`
  );
  return rows;
};

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

const obtenerFicha = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT e.id_empleado,
            e.numero_documento,
            e.complemento_documento,
            e.nombres,
            e.primer_apellido,
            e.segundo_apellido,
            ${NOMBRE_COMPLETO} AS nombre_completo,
            e.fecha_nacimiento,
            e.genero,
            e.telefono_celular,
            e.correo_personal,
            e.direccion_domicilio,
            e.fecha_ingreso,
            ee.codigo AS estado_codigo,
            ee.nombre AS estado_nombre,
            c.id_cargo,
            c.codigo AS cargo_codigo,
            c.nombre AS cargo_nombre,
            c.esta_activo AS cargo_activo,
            d.id_departamento,
            d.nombre AS area_nombre,
            s.id_sucursal,
            s.nombre AS sucursal_nombre,
            s.ciudad AS sucursal_ciudad,
            a.id_asignacion,
            a.fecha_inicio AS vigente_desde
       FROM empleados e
       JOIN estados_empleado ee ON ee.id_estado_empleado = e.id_estado_empleado
       JOIN cargos c            ON c.id_cargo = e.id_cargo_actual
       JOIN departamentos d     ON d.id_departamento = c.id_departamento
       JOIN sucursales s        ON s.id_sucursal = e.id_sucursal_actual
       LEFT JOIN asignaciones_empleado a ON a.id_empleado = e.id_empleado AND a.es_vigente = TRUE
      WHERE e.id_empleado = $1`,
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

module.exports = { listar, bloquearPorId, obtenerFicha, actualizarAsignacionActual };
