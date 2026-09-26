const { randomUUID } = require('node:crypto');

const SELECT_CARGO = `
  SELECT
    c.id_cargo,
    c.codigo,
    c.nombre,
    c.id_departamento,
    d.nombre AS departamento,
    c.id_cargo_jefe_directo,
    j.nombre AS cargo_jefe_directo,
    c.nivel_jerarquico,
    c.salario_base_referencial,
    c.requisitos_minimos,
    c.funciones_clave,
    c.esta_activo
  FROM cargos c
  JOIN departamentos d ON d.id_departamento = c.id_departamento
  LEFT JOIN cargos j   ON j.id_cargo = c.id_cargo_jefe_directo
`;

const SEPARADOR_FUNCIONES = '\n';

const aCargo = ({ funciones_clave, ...fila }) => ({
  ...fila,
  funciones: funciones_clave.split(SEPARADOR_FUNCIONES).filter((f) => f.trim() !== ''),
});

const listar = async (db, { idDepartamento } = {}) => {
  const valores = [];
  let query = `${SELECT_CARGO} WHERE c.esta_activo = TRUE`;

  if (idDepartamento) {
    valores.push(idDepartamento);
    query += ` AND c.id_departamento = $${valores.length}`;
  }

  query += ' ORDER BY c.nivel_jerarquico ASC, c.nombre ASC';
  const { rows } = await db.query(query, valores);
  return rows.map(aCargo);
};

const obtenerPorId = async (db, idCargo) => {
  const { rows } = await db.query(`${SELECT_CARGO} WHERE c.id_cargo = $1`, [idCargo]);
  return rows[0] ? aCargo(rows[0]) : null;
};

const bloquearPorId = async (db, idCargo) => {
  const { rows } = await db.query('SELECT id_cargo FROM cargos WHERE id_cargo = $1 FOR UPDATE', [idCargo]);
  return rows.length > 0;
};

const insertar = async (db, cargo) => {
  const { rows } = await db.query(
    `INSERT INTO cargos (
       id_cargo, id_departamento, id_cargo_jefe_directo, codigo, nombre,
       nivel_jerarquico, salario_base_referencial, funciones_clave, requisitos_minimos
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_cargo`,
    [
      randomUUID(),
      cargo.id_departamento,
      cargo.id_cargo_jefe_directo,
      cargo.codigo,
      cargo.nombre,
      cargo.nivel_jerarquico,
      cargo.salario_base_referencial,
      cargo.funciones.join(SEPARADOR_FUNCIONES),
      cargo.requisitos_minimos,
    ]
  );
  return rows[0].id_cargo;
};

const reemplazar = async (db, idCargo, cargo) => {
  await db.query(
    `UPDATE cargos
        SET id_departamento = $1,
            id_cargo_jefe_directo = $2,
            codigo = $3,
            nombre = $4,
            nivel_jerarquico = $5,
            salario_base_referencial = $6,
            funciones_clave = $7,
            requisitos_minimos = $8
      WHERE id_cargo = $9`,
    [
      cargo.id_departamento,
      cargo.id_cargo_jefe_directo,
      cargo.codigo,
      cargo.nombre,
      cargo.nivel_jerarquico,
      cargo.salario_base_referencial,
      cargo.funciones.join(SEPARADOR_FUNCIONES),
      cargo.requisitos_minimos,
      idCargo,
    ]
  );
};

// El código no tiene restricción UNIQUE en la BD; se controla aquí entre los cargos activos.
const existeCodigoActivo = async (db, codigo, idCargoExcluido = null) => {
  const { rows } = await db.query(
    `SELECT 1 FROM cargos
      WHERE esta_activo = TRUE
        AND lower(codigo) = lower($1)
        AND ($2::uuid IS NULL OR id_cargo <> $2::uuid)
      LIMIT 1`,
    [codigo, idCargoExcluido]
  );
  return rows.length > 0;
};

// FOR SHARE: impide que el área se dé de baja mientras se le asigna este cargo.
const obtenerEstadoDepartamento = async (db, idDepartamento) => {
  const { rows } = await db.query(
    'SELECT esta_activo FROM departamentos WHERE id_departamento = $1 FOR SHARE',
    [idDepartamento]
  );
  return rows[0] || null;
};

const obtenerEstadoCargo = async (db, idCargo) => {
  const { rows } = await db.query('SELECT esta_activo FROM cargos WHERE id_cargo = $1', [idCargo]);
  return rows[0] || null;
};

// ¿idPosibleSubordinado está por debajo de idCargo en la cadena de jefes directos? Evita ciclos en la jerarquía.
const esSubordinado = async (db, idCargo, idPosibleSubordinado) => {
  const { rows } = await db.query(
    `WITH RECURSIVE subordinados AS (
       SELECT id_cargo FROM cargos WHERE id_cargo_jefe_directo = $1
       UNION
       SELECT c.id_cargo FROM cargos c JOIN subordinados s ON c.id_cargo_jefe_directo = s.id_cargo
     )
     SELECT 1 FROM subordinados WHERE id_cargo = $2 LIMIT 1`,
    [idCargo, idPosibleSubordinado]
  );
  return rows.length > 0;
};

module.exports = {
  listar,
  obtenerPorId,
  bloquearPorId,
  insertar,
  reemplazar,
  existeCodigoActivo,
  obtenerEstadoDepartamento,
  obtenerEstadoCargo,
  esSubordinado,
};
