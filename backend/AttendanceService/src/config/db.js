const { Pool, types } = require("pg");

// DATE como texto AAAA-MM-DD, sin convertir a zona horaria.
types.setTypeParser(types.builtins.DATE, (valor) => valor);

module.exports = new Pool({ connectionString: process.env.DATABASE_URL });
