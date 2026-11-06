const { Pool, types } = require("pg");

types.setTypeParser(types.builtins.DATE, (valor) => valor);
types.setTypeParser(types.builtins.NUMERIC, (valor) => Number(valor));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

pool.on("error", (error) => {
  console.error(
    "Error inesperado en una conexión inactiva de PostgreSQL:",
    error.message,
  );
});

module.exports = pool;
