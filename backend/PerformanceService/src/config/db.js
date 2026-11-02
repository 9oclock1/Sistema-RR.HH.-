const { Pool, types } = require("pg");

// NUMERIC (pesos y valores de escala) como número: no superan dos decimales.
types.setTypeParser(types.builtins.NUMERIC, (valor) => Number(valor));

module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
