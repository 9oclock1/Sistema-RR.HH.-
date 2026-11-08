const pool = require("../config/db");

async function obtenerSucursalDeQueja(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT q.id_sucursal, su.nombre AS sucursal_nombre, eq.es_final
     FROM quejas q
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = q.id_estado_queja
     LEFT JOIN sucursales su ON su.id_sucursal = q.id_sucursal
     WHERE q.id_queja = $1`,
    [idQueja],
  );
  return rows[0] ?? null;
}

async function sincronizarSucursal(db, { idSucursal, nombre }) {
  await db.query(
    `INSERT INTO sucursales (id_sucursal, nombre)
     VALUES ($1, $2)
     ON CONFLICT (id_sucursal) DO UPDATE
       SET nombre = EXCLUDED.nombre,
           actualizado_en = CURRENT_TIMESTAMP`,
    [idSucursal, nombre],
  );
}

async function asignarSucursal(db, { idQueja, idSucursal }) {
  await db.query(
    `UPDATE quejas
     SET id_sucursal = $2,
         actualizado_en = CURRENT_TIMESTAMP
     WHERE id_queja = $1`,
    [idQueja, idSucursal],
  );
}

module.exports = { obtenerSucursalDeQueja, sincronizarSucursal, asignarSucursal };
