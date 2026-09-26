const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Verify connection on startup
pool.on("error", (err) => {
  console.error("[DB] Unexpected error on idle client:", err.message);
});

module.exports = pool;
