const { Pool, types } = require("pg");

// DATE como texto AAAA-MM-DD, sin convertir a zona horaria
types.setTypeParser(types.builtins.DATE, (valor) => valor);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("[DB] Error inesperado en cliente inactivo:", err.message);
});

module.exports = pool;
