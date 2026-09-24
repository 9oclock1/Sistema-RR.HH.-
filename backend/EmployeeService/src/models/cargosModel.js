const SELECT_CARGO = `
  SELECT
    c.id_cargo,
    c.nombre,
    c.id_nivel_salarial,
    ns.nombre AS nivel_salarial,
    c.id_departamento,
    d.nombre  AS departamento,
    c.id_cargo_superior,
    c.perfil_requerido,
    COALESCE(
      (SELECT json_agg(f.descripcion ORDER BY f.orden, f.id_funcion)
         FROM funciones_cargo f
        WHERE f.id_cargo = c.id_cargo),
      '[]'::json
    ) AS funciones,
    c.activo,
    c.fecha_creacion,
    c.fecha_modificacion
  FROM cargos c
  JOIN niveles_salariales ns ON ns.id_nivel = c.id_nivel_salarial
  LEFT JOIN departamentos d  ON d.id_departamento = c.id_departamento
`;

const listar = async (db, { idDepartamento } = {}) => {
  const valores = [];
  let query = `${SELECT_CARGO} WHERE c.activo = TRUE`;

  if (idDepartamento) {
    valores.push(idDepartamento);
    query += ` AND c.id_departamento = $${valores.length}`;
  }

  query += ' ORDER BY c.id_cargo ASC';
  const { rows } = await db.query(query, valores);
  return rows;
};

const obtenerPorId = async (db, idCargo) => {
  const { rows } = await db.query(`${SELECT_CARGO} WHERE c.id_cargo = $1`, [idCargo]);
  return rows[0] || null;
};

const bloquearPorId = async (db, idCargo) => {
  const { rows } = await db.query('SELECT id_cargo FROM cargos WHERE id_cargo = $1 FOR UPDATE', [idCargo]);
  return rows.length > 0;
};

const insertar = async (db, cargo) => {
  const { rows } = await db.query(
    `INSERT INTO cargos (nombre, id_nivel_salarial, id_departamento, id_cargo_superior, perfil_requerido)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_cargo`,
    [cargo.nombre, cargo.id_nivel_salarial, cargo.id_departamento, cargo.id_cargo_superior, cargo.perfil_requerido]
  );
  return rows[0].id_cargo;
};

const reemplazar = async (db, idCargo, cargo) => {
  await db.query(
    `UPDATE cargos
        SET nombre = $1,
            id_nivel_salarial = $2,
            id_departamento = $3,
            id_cargo_superior = $4,
            perfil_requerido = $5
      WHERE id_cargo = $6`,
    [cargo.nombre, cargo.id_nivel_salarial, cargo.id_departamento, cargo.id_cargo_superior, cargo.perfil_requerido, idCargo]
  );
};

const eliminarFunciones = async (db, idCargo) => {
  await db.query('DELETE FROM funciones_cargo WHERE id_cargo = $1', [idCargo]);
};

const insertarFuncion = async (db, idCargo, descripcion, orden) => {
  await db.query(
    'INSERT INTO funciones_cargo (id_cargo, descripcion, orden) VALUES ($1, $2, $3)',
    [idCargo, descripcion, orden]
  );
};


const existeNivelSalarial = async (db, idNivel) => {
  const { rows } = await db.query('SELECT 1 FROM niveles_salariales WHERE id_nivel = $1', [idNivel]);
  return rows.length > 0;
};

const obtenerEstadoDepartamento = async (db, idDepartamento) => {
  const { rows } = await db.query('SELECT activo FROM departamentos WHERE id_departamento = $1', [idDepartamento]);
  return rows[0] || null;
};

const obtenerEstadoCargo = async (db, idCargo) => {
  const { rows } = await db.query('SELECT activo FROM cargos WHERE id_cargo = $1', [idCargo]);
  return rows[0] || null;
};

module.exports = {
  listar,
  obtenerPorId,
  bloquearPorId,
  insertar,
  reemplazar,
  eliminarFunciones,
  insertarFuncion,
  existeNivelSalarial,
  obtenerEstadoDepartamento,
  obtenerEstadoCargo,
};
