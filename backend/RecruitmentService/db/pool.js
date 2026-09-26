// db/pool.js
const { Pool, types } = require('pg');
const { zonaHoraria } = require('../src/config');

// DATE se devuelve tal cual ('YYYY-MM-DD'); 
types.setTypeParser(types.builtins.DATE, (valor) => valor);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // El servidor corre en UTC. CURRENT_DATE decide si una convocatoria sigue abierta, así que debe ser la fecha local.
  options: `-c TimeZone=${zonaHoraria}`,
});

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL', err);
});

module.exports = pool;
