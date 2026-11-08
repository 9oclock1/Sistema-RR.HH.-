const pool = require("../config/db");

const SELECT_COMPETENCIA = `
  SELECT c.id_competencia, c.nombre, c.descripcion, c.esta_activa, c.creado_en,
         t.codigo AS tipo_codigo, t.nombre AS tipo_nombre
  FROM competencias c
  JOIN catalogos_tipo_competencia t ON t.id_tipo_competencia = c.id_tipo_competencia`;

async function listar({ idTipo, soloActivas, busqueda }, db = pool) {
  const { rows } = await db.query(
    `${SELECT_COMPETENCIA}
     WHERE ($1::smallint IS NULL OR c.id_tipo_competencia = $1)
       AND (NOT $2::boolean OR c.esta_activa)
       AND ($3::text IS NULL OR c.nombre ILIKE '%' || $3 || '%')
     ORDER BY t.id_tipo_competencia, c.nombre`,
    [idTipo, soloActivas, busqueda],
  );
  return rows;
}

async function obtener(idCompetencia, db = pool) {
  const { rows } = await db.query(`${SELECT_COMPETENCIA} WHERE c.id_competencia = $1`, [idCompetencia]);
  return rows[0] ?? null;
}

async function buscarPorNombre(nombre, db = pool) {
  const { rows } = await db.query(
    `SELECT id_competencia, nombre FROM competencias WHERE lower(btrim(nombre)) = lower(btrim($1)) LIMIT 1`,
    [nombre],
  );
  return rows[0] ?? null;
}

async function crear({ nombre, descripcion, idTipo }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO competencias (id_tipo_competencia, nombre, descripcion) VALUES ($1, $2, $3) RETURNING id_competencia`,
    [idTipo, nombre, descripcion],
  );
  return rows[0].id_competencia;
}

module.exports = { listar, obtener, buscarPorNombre, crear };
