const { Pool, types } = require("pg");

// DATE como texto AAAA-MM-DD, sin convertir a zona horaria.
types.setTypeParser(types.builtins.DATE, (valor) => valor);
// NUMERIC como número: valores con pocos decimales, sin riesgo de perder precisión.
types.setTypeParser(types.builtins.NUMERIC, (valor) => Number(valor));

module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
