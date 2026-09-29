// src/models/jerarquia.model.js
const pool = require('../../db/pool');

// Todos los cambios de jerarquía se serializan con un lock de aviso: así dos personas
// no pueden crear un ciclo a la vez (A->B y B->A en paralelo) sin que el chequeo lo vea.
async function enTransaccion(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SELECT pg_advisory_xact_lock(hashtext('jerarquia_cargos'))`);
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function listarCargosActivos(db = pool) {
  const { rows } = await db.query(
    `SELECT c.id_cargo, c.codigo, c.nombre, d.nombre AS departamento,
            c.id_cargo_jefe_directo AS id_cargo_superior,
            s.nombre AS superior_nombre
       FROM cargos c
       JOIN departamentos d ON d.id_departamento = c.id_departamento
       LEFT JOIN cargos s ON s.id_cargo = c.id_cargo_jefe_directo
      WHERE c.esta_activo = TRUE
      ORDER BY c.nombre;`
  );
  return rows;
}

async function obtenerCargo(id, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT id_cargo, nombre, esta_activo, id_cargo_jefe_directo
       FROM cargos WHERE id_cargo = $1 ${bloquear ? 'FOR UPDATE' : ''};`,
    [id]
  );
  return rows[0] || null;
}

// ¿"idCargo" ya es ancestro de "idSuperior" (o es él mismo)? Entonces asignarlo cerraría un ciclo.
// UNION (sin ALL) hace que termine aunque ya hubiera un ciclo guardado.
async function generaCiclo(idCargo, idSuperior, db = pool) {
  const { rows } = await db.query(
    `WITH RECURSIVE ancestros AS (
        SELECT id_cargo, id_cargo_jefe_directo FROM cargos WHERE id_cargo = $2
        UNION
        SELECT c.id_cargo, c.id_cargo_jefe_directo
          FROM cargos c JOIN ancestros a ON c.id_cargo = a.id_cargo_jefe_directo
     )
     SELECT EXISTS (SELECT 1 FROM ancestros WHERE id_cargo = $1) AS ciclo;`,
    [idCargo, idSuperior]
  );
  return rows[0].ciclo;
}

async function actualizarSuperior(idCargo, idSuperior, db = pool) {
  await db.query(`UPDATE cargos SET id_cargo_jefe_directo = $2 WHERE id_cargo = $1;`, [idCargo, idSuperior]);
}

// Ian puede importar esta misma función desde su modelo/controlador de
// cargos y llamarla después de cualquier UPDATE/INSERT que toque
// id_cargo_jefe_directo (PUT /cargos/:id, POST /cargos), para que ese
// cambio también quede en el historial.
async function registrarHistorial({ idCargo, anterior, nuevo }, db = pool) {
  await db.query(
    `INSERT INTO historial_jerarquia_cargo
       (id_historial, id_cargo, id_cargo_jefe_anterior, id_cargo_jefe_nuevo, cambiado_en)
     VALUES (gen_random_uuid(), $1, $2, $3, clock_timestamp());`,
    [idCargo, anterior, nuevo]
  );
}

async function listarSubordinados(idCargo, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id_cargo, c.codigo, c.nombre, d.nombre AS departamento
       FROM cargos c
       JOIN departamentos d ON d.id_departamento = c.id_departamento
      WHERE c.id_cargo_jefe_directo = $1 AND c.esta_activo = TRUE
      ORDER BY c.nombre;`,
    [idCargo]
  );
  return rows;
}

async function listarHistorial(idCargo, db = pool) {
  const { rows } = await db.query(
    `SELECT h.id_historial, h.cambiado_en,
            h.id_cargo_jefe_anterior, a.nombre AS superior_anterior,
            h.id_cargo_jefe_nuevo, n.nombre AS superior_nuevo
       FROM historial_jerarquia_cargo h
       LEFT JOIN cargos a ON a.id_cargo = h.id_cargo_jefe_anterior
       LEFT JOIN cargos n ON n.id_cargo = h.id_cargo_jefe_nuevo
      WHERE h.id_cargo = $1
      ORDER BY h.cambiado_en DESC, h.id_historial;`,
    [idCargo]
  );
  return rows;
}

module.exports = {
  enTransaccion, listarCargosActivos, obtenerCargo, generaCiclo,
  actualizarSuperior, registrarHistorial, listarSubordinados, listarHistorial,
};