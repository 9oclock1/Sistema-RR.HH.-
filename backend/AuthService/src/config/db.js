const { Pool } = require("pg");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Sin este manejador, una conexión inactiva que se corta (por ejemplo, si se reinicia PostgreSQL) tumba el proceso.
pool.on("error", (error) => {
  console.error("Error inesperado en una conexión inactiva de PostgreSQL:", error.message);
});

module.exports = pool;
