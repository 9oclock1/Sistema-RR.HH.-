const { Pool, types } = require("pg");

// DATE como texto AAAA-MM-DD, sin convertir a zona horaria.
types.setTypeParser(types.builtins.DATE, (valor) => valor);
// NUMERIC como número: valores con pocos decimales, sin riesgo de perder precisión.
types.setTypeParser(types.builtins.NUMERIC, (valor) => Number(valor));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Sin este manejador, una conexión inactiva que se corta (por ejemplo, si se reinicia PostgreSQL) tumba el proceso.
pool.on("error", (error) => {
  console.error("Error inesperado en una conexión inactiva de PostgreSQL:", error.message);
});

module.exports = pool;
