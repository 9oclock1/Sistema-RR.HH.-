const pool = require("../config/db");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

const conCatalogos = (origen) => `
  SELECT r.id_rol, r.id_sucursal, r.id_departamento, r.fecha_inicio, r.fecha_fin,
         r.version_publicada, r.tiene_cambios_sin_publicar, r.publicado_en, r.creado_en, r.actualizado_en,
         p.codigo AS periodo_codigo, p.nombre AS periodo_nombre,
         e.codigo AS estado_codigo, e.nombre AS estado_nombre
  FROM ${origen} r
  JOIN catalogos_periodo_rol p USING (id_periodo_rol)
  JOIN catalogos_estado_rol e USING (id_estado_rol)`;

async function crear({ id_sucursal, id_departamento, id_periodo_rol, fecha_inicio, fecha_fin }) {
  const { rows } = await pool.query(
    `WITH nuevo AS (
       INSERT INTO roles_turno (id_sucursal, id_departamento, id_periodo_rol, fecha_inicio, fecha_fin)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *
     ) ${conCatalogos("nuevo")}`,
    [id_sucursal, id_departamento, id_periodo_rol, fecha_inicio, fecha_fin]
  );
  return rows[0];
}

async function buscarSolapado({ id_sucursal, id_departamento, fecha_inicio, fecha_fin }) {
  const { rows } = await pool.query(
    `${conCatalogos("roles_turno")}
     WHERE r.id_sucursal = $1 AND r.id_departamento = $2
       AND daterange(r.fecha_inicio, r.fecha_fin, '[]') && daterange($3::date, $4::date, '[]')
     ORDER BY r.fecha_inicio LIMIT 1`,
    [id_sucursal, id_departamento, fecha_inicio, fecha_fin]
  );
  return rows[0];
}

async function listar({ idSucursal = null, idDepartamento = null }) {
  const { rows } = await pool.query(
    `${conCatalogos("roles_turno")}
     WHERE ($1::uuid IS NULL OR r.id_sucursal = $1) AND ($2::uuid IS NULL OR r.id_departamento = $2)
     ORDER BY r.fecha_inicio DESC`,
    [idSucursal, idDepartamento]
  );
  return rows;
}

async function obtener(id, db = pool) {
  const { rows } = await db.query(`${conCatalogos("roles_turno")} WHERE r.id_rol = $1`, [id]);
  return rows[0];
}

async function bloquear(cliente, id) {
  const { rows } = await cliente.query("SELECT id_rol FROM roles_turno WHERE id_rol = $1 FOR UPDATE", [id]);
  return rows.length > 0;
}

async function listarAsignaciones(idRol, db = pool) {
  const { rows } = await db.query(
    `SELECT id_empleado, fecha, id_turno, es_descanso AS descanso
     FROM asignaciones_rol_turno WHERE id_rol = $1
     ORDER BY id_empleado, fecha`,
    [idRol]
  );
  return rows;
}

// Celdas de otros roles en los días que rodean al periodo, para validar el descanso en los bordes.
async function listarAsignacionesVecinas(idRol, idsEmpleados, desde, hasta) {
  if (idsEmpleados.length === 0) return [];
  const { rows } = await pool.query(
    `SELECT id_empleado, fecha, id_turno, es_descanso AS descanso
     FROM asignaciones_rol_turno
     WHERE id_rol <> $1 AND id_empleado = ANY($2::uuid[]) AND fecha BETWEEN $3 AND $4`,
    [idRol, idsEmpleados, desde, hasta]
  );
  return rows;
}

async function listarTurnos(ids, db = pool) {
  if (ids.length === 0) return [];
  const { rows } = await db.query(
    `SELECT t.id_turno, t.nombre, t.hora_inicio, t.hora_fin, t.esta_activo, c.codigo AS tipo_codigo
     FROM turnos t JOIN catalogos_tipo_jornada c USING (id_tipo_jornada)
     WHERE t.id_turno = ANY($1::uuid[])`,
    [ids]
  );
  return rows;
}

async function aplicarCambios(cliente, idRol, cambios) {
  const llenas = cambios.filter((c) => c.id_turno !== null || c.descanso);
  const vacias = cambios.filter((c) => c.id_turno === null && !c.descanso);

  if (llenas.length > 0) {
    await cliente.query(
      `INSERT INTO asignaciones_rol_turno (id_rol, id_empleado, fecha, id_turno, es_descanso)
       SELECT $1, x.id_empleado, x.fecha, x.id_turno, x.descanso
       FROM unnest($2::uuid[], $3::date[], $4::uuid[], $5::boolean[]) AS x(id_empleado, fecha, id_turno, descanso)
       ON CONFLICT (id_rol, id_empleado, fecha) DO UPDATE
         SET id_turno = EXCLUDED.id_turno, es_descanso = EXCLUDED.es_descanso, actualizado_en = CURRENT_TIMESTAMP`,
      [
        idRol,
        llenas.map((c) => c.id_empleado),
        llenas.map((c) => c.fecha),
        llenas.map((c) => c.id_turno),
        llenas.map((c) => c.descanso),
      ]
    );
  }
  if (vacias.length > 0) {
    await cliente.query(
      `DELETE FROM asignaciones_rol_turno a
       USING unnest($2::uuid[], $3::date[]) AS x(id_empleado, fecha)
       WHERE a.id_rol = $1 AND a.id_empleado = x.id_empleado AND a.fecha = x.fecha`,
      [idRol, vacias.map((c) => c.id_empleado), vacias.map((c) => c.fecha)]
    );
  }
  await cliente.query(
    `UPDATE roles_turno SET tiene_cambios_sin_publicar = TRUE, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_rol = $1`,
    [idRol]
  );
}

// Reemplaza lo publicado del rol por su borrador actual (solo del personal indicado).
async function publicar(cliente, idRol, idsEmpleados) {
  await cliente.query("DELETE FROM turnos_publicados WHERE id_rol = $1", [idRol]);
  await cliente.query(
    `INSERT INTO turnos_publicados (id_rol, id_empleado, fecha, id_turno, es_descanso, nombre_turno, hora_inicio, hora_fin)
     SELECT a.id_rol, a.id_empleado, a.fecha, a.id_turno, a.es_descanso, t.nombre, t.hora_inicio, t.hora_fin
     FROM asignaciones_rol_turno a LEFT JOIN turnos t USING (id_turno)
     WHERE a.id_rol = $1 AND a.id_empleado = ANY($2::uuid[])`,
    [idRol, idsEmpleados]
  );
  const { rows } = await cliente.query(
    `WITH publicado AS (
       UPDATE roles_turno
       SET id_estado_rol = 2, version_publicada = version_publicada + 1, tiene_cambios_sin_publicar = FALSE,
           publicado_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
       WHERE id_rol = $1
       RETURNING *
     ) ${conCatalogos("publicado")}`,
    [idRol]
  );
  return rows[0];
}

async function eliminarBorrador(id) {
  const { rowCount } = await pool.query("DELETE FROM roles_turno WHERE id_rol = $1 AND version_publicada = 0", [id]);
  return rowCount;
}

async function listarPublicadosDeEmpleado(idEmpleado, desde, hasta) {
  const { rows } = await pool.query(
    `SELECT fecha, es_descanso AS descanso, nombre_turno, hora_inicio, hora_fin
     FROM turnos_publicados
     WHERE id_empleado = $1 AND fecha BETWEEN $2 AND $3
     ORDER BY fecha`,
    [idEmpleado, desde, hasta]
  );
  return rows;
}

async function hoy() {
  const { rows } = await pool.query(`SELECT ${HOY_BOLIVIA} AS hoy`);
  return rows[0].hoy;
}

module.exports = {
  crear,
  buscarSolapado,
  listar,
  obtener,
  bloquear,
  listarAsignaciones,
  listarAsignacionesVecinas,
  listarTurnos,
  aplicarCambios,
  publicar,
  eliminarBorrador,
  listarPublicadosDeEmpleado,
  hoy,
};
