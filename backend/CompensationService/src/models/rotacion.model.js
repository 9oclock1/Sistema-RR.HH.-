const pool = require("../config/db");

// Bajas vigentes (todo proceso que no fue anulado) con su causal.
async function listarBajas() {
  const { rows } = await pool.query(
    `SELECT id_empleado, fecha_ingreso, fecha_retiro, codigo_causal
       FROM PROCESOS_DESVINCULACION
      WHERE estado <> 'ANULADO'`
  );
  return rows;
}

async function listarCausales() {
  const { rows } = await pool.query(
    `SELECT codigo, nombre
       FROM CAUSALES_DESVINCULACION
      ORDER BY orden ASC`
  );
  return rows;
}

module.exports = { listarBajas, listarCausales };
