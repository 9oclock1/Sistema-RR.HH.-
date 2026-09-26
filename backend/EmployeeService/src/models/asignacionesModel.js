const { randomUUID } = require('node:crypto');

const fechaActual = async (db) => {
  const { rows } = await db.query('SELECT CURRENT_DATE AS hoy');
  return rows[0].hoy;
};

const obtenerVigente = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT id_asignacion, id_cargo, id_sucursal, fecha_inicio
       FROM asignaciones_empleado
      WHERE id_empleado = $1 AND es_vigente = TRUE
        FOR UPDATE`,
    [idEmpleado]
  );
  return rows[0] || null;
};

const cerrar = async (db, idAsignacion, fechaFin) => {
  await db.query(
    'UPDATE asignaciones_empleado SET es_vigente = FALSE, fecha_fin = $1 WHERE id_asignacion = $2',
    [fechaFin, idAsignacion]
  );
};

const insertarVigente = async (db, asignacion) => {
  const { rows } = await db.query(
    `INSERT INTO asignaciones_empleado (id_asignacion, id_empleado, id_cargo, id_sucursal, fecha_inicio, es_vigente)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     RETURNING id_asignacion`,
    [randomUUID(), asignacion.id_empleado, asignacion.id_cargo, asignacion.id_sucursal, asignacion.fecha_inicio]
  );
  return rows[0].id_asignacion;
};

const listarPorEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT a.id_asignacion,
            a.id_cargo,
            c.nombre AS cargo,
            d.nombre AS area,
            a.id_sucursal,
            s.nombre AS sucursal,
            a.fecha_inicio,
            a.fecha_fin,
            a.es_vigente
       FROM asignaciones_empleado a
       JOIN cargos c        ON c.id_cargo = a.id_cargo
       JOIN departamentos d ON d.id_departamento = c.id_departamento
       JOIN sucursales s    ON s.id_sucursal = a.id_sucursal
      WHERE a.id_empleado = $1
      ORDER BY a.es_vigente DESC, a.fecha_inicio DESC, a.registrado_en DESC`,
    [idEmpleado]
  );
  return rows;
};

module.exports = { fechaActual, obtenerVigente, cerrar, insertarVigente, listarPorEmpleado };
