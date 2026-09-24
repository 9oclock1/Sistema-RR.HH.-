const listar = async (db) => {
  const { rows } = await db.query(
    `SELECT id_nivel, nombre, salario_base, salario_max
       FROM niveles_salariales
      ORDER BY salario_base ASC, id_nivel ASC`
  );
  return rows;
};

module.exports = { listar };
