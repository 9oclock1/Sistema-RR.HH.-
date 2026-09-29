// src/models/departamentos.model.js
const { randomUUID } = require('node:crypto');

const SELECT_DEPARTAMENTO = `
  SELECT
    d.id_departamento,
    d.codigo,
    d.nombre,
    d.descripcion,
    d.id_departamento_padre,
    p.nombre AS departamento_padre,
    d.esta_activo
  FROM departamentos d
  LEFT JOIN departamentos p ON p.id_departamento = d.id_departamento_padre
`;

async function listarActivos(db) {
  const { rows } = await db.query(`${SELECT_DEPARTAMENTO} WHERE d.esta_activo = TRUE ORDER BY d.nombre ASC`);
  return rows;
}

async function obtenerPorId(db, idDepartamento) {
  const { rows } = await db.query(`${SELECT_DEPARTAMENTO} WHERE d.id_departamento = $1`, [idDepartamento]);
  return rows[0] || null;
}

async function bloquearPorId(db, idDepartamento) {
  const { rows } = await db.query(
    'SELECT nombre, esta_activo FROM departamentos WHERE id_departamento = $1 FOR UPDATE',
    [idDepartamento]
  );
  return rows[0] || null;
}

async function obtenerEstadoPadre(db, idDepartamento) {
  const { rows } = await db.query(
    'SELECT esta_activo FROM departamentos WHERE id_departamento = $1 FOR SHARE',
    [idDepartamento]
  );
  return rows[0] || null;
}


async function insertar(db, { codigo, nombre, descripcion, id_departamento_padre }) {
  const { rows } = await db.query(
    `INSERT INTO departamentos (id_departamento, id_departamento_padre, codigo, nombre, descripcion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id_departamento`,
    [randomUUID(), id_departamento_padre, codigo, nombre, descripcion]
  );
  return rows[0].id_departamento;
}

async function reemplazar(db, idDepartamento, { codigo, nombre, descripcion, id_departamento_padre }) {
  await db.query(
    `UPDATE departamentos
        SET codigo = $1,
            nombre = $2,
            descripcion = $3,
            id_departamento_padre = $4
      WHERE id_departamento = $5`,
    [codigo, nombre, descripcion, id_departamento_padre, idDepartamento]
  );
}

async function existeCodigoActivo(db, codigo, idDepartamentoExcluido = null) {
  const { rows } = await db.query(
    `SELECT 1 FROM departamentos
      WHERE esta_activo = TRUE
        AND lower(codigo) = lower($1)
        AND ($2::uuid IS NULL OR id_departamento <> $2::uuid)
      LIMIT 1`,
    [codigo, idDepartamentoExcluido]
  );
  return rows.length > 0;
}

async function esDescendiente(db, idDepartamento, idPosibleDescendiente) {
  const { rows } = await db.query(
    `WITH RECURSIVE descendientes AS (
       SELECT id_departamento FROM departamentos WHERE id_departamento_padre = $1
       UNION
       SELECT d.id_departamento FROM departamentos d
         JOIN descendientes x ON d.id_departamento_padre = x.id_departamento
     )
     SELECT 1 FROM descendientes WHERE id_departamento = $2 LIMIT 1`,
    [idDepartamento, idPosibleDescendiente]
  );
  return rows.length > 0;
}

async function contarDependencias(db, idDepartamento) {
  const { rows } = await db.query(
    `SELECT
       (SELECT COUNT(*) FROM empleados e
          JOIN cargos c           ON c.id_cargo = e.id_cargo_actual
          JOIN estados_empleado s ON s.id_estado_empleado = e.id_estado_empleado
         WHERE c.id_departamento = $1
           AND s.permite_acceso = TRUE)::int                                         AS empleados,
       (SELECT COUNT(*) FROM cargos
         WHERE id_departamento = $1 AND esta_activo = TRUE)::int                     AS cargos,
       (SELECT COUNT(*) FROM departamentos
         WHERE id_departamento_padre = $1 AND esta_activo = TRUE)::int               AS subareas`,
    [idDepartamento]
  );
  return rows[0];
}

async function darDeBaja(db, idDepartamento) {
  await db.query('UPDATE departamentos SET esta_activo = FALSE WHERE id_departamento = $1', [idDepartamento]);
}

module.exports = {
  listarActivos,
  obtenerPorId,
  bloquearPorId,
  obtenerEstadoPadre,
  insertar,
  reemplazar,
  existeCodigoActivo,
  esDescendiente,
  contarDependencias,
  darDeBaja,
};
