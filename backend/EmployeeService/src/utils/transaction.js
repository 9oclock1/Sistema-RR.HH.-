const pool = require('../../db/pool');

const withTransaction = async (trabajo) => {
  const client = await pool.connect();
  let clienteRoto = false;

  try {
    await client.query('BEGIN');
    const resultado = await trabajo(client);
    await client.query('COMMIT');
    return resultado;
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch (errorRollback) {
      clienteRoto = true;
      console.error('Fallo el ROLLBACK de la transacción', errorRollback);
    }
    throw error;
  } finally {
    client.release(clienteRoto);
  }
};

module.exports = { withTransaction };
