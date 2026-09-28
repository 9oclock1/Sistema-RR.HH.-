const { Pool, types } = require("pg");

// Parsear DATE como string YYYY-MM-DD
types.setTypeParser(types.builtins.DATE, (valor) => valor);

const connectionString =
  process.env.DATABASE_URL || "postgres://adminRRHH:sistemaRRHH12@postgres:5432/NotificationDB";

const pool = new Pool({
  connectionString,
  max: 20, // número máximo de clientes en el pool para escalabilidad
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 3000,
});

pool.on("error", (err) => {
  // Evitar que errores en clientes ociosos detengan el servicio
  console.error("Error inesperado en cliente inactivo de PostgreSQL:", err.message);
});

module.exports = pool;
