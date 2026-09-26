const obtenerEstado = async (db, idSucursal) => {
  const { rows } = await db.query('SELECT nombre, esta_activa FROM sucursales WHERE id_sucursal = $1 FOR SHARE', [
    idSucursal,
  ]);
  return rows[0] || null;
};

module.exports = { obtenerEstado };
