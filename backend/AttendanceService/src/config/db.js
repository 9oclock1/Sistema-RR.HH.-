const { Pool, types } = require("pg");

// DATE como texto AAAA-MM-DD, sin convertir a zona horaria.
types.setTypeParser(types.builtins.DATE, (valor) => valor);

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Sin este manejador, una conexión ociosa que PostgreSQL cierra (p. ej. al reiniciarse) tumba todo el servicio.
pool.on("error", (error) => {
  console.error("Error inesperado en una conexión inactiva de PostgreSQL:", error.message);
});

module.exports = pool;
