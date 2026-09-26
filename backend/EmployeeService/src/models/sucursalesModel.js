const listarActivas = async (db) => {
  const { rows } = await db.query(
    `SELECT id_sucursal, codigo_sucursal, nombre, direccion, ciudad, telefono_contacto
       FROM sucursales
      WHERE esta_activa = TRUE
      ORDER BY nombre ASC`
  );
  return rows;
};

const obtenerEstado = async (db, idSucursal) => {
  const { rows } = await db.query('SELECT nombre, esta_activa FROM sucursales WHERE id_sucursal = $1 FOR SHARE', [
    idSucursal,
  ]);
  return rows[0] || null;
};

module.exports = { listarActivas, obtenerEstado };
