// db/pool.js
const { Pool, types } = require('pg');

types.setTypeParser(types.builtins.DATE, (valor) => valor);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  options: `-c TimeZone=${process.env.APP_TIMEZONE || 'America/La_Paz'}`,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

module.exports = pool;
