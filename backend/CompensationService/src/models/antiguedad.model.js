const pool = require("../config/db");

async function listarVigencias() {
  const { rows } = await pool.query(
    "SELECT id_vigencia, vigente_desde, vigente_hasta, motivo, creado_en FROM vigencias_escala_antiguedad " +
      "ORDER BY vigente_desde DESC"
  );
  return rows;
}

async function listarTramos(idVigencia) {
  const { rows } = await pool.query(
    "SELECT id_tramo, anios_desde, anios_hasta, porcentaje FROM tramos_antiguedad " +
      "WHERE id_vigencia = $1 ORDER BY anios_desde",
    [idVigencia]
  );
  return rows;
}

// La vigencia cuyo rango de fechas contiene la fecha dada, o null si ninguna la cubre.
async function obtenerVigenciaEnFecha(fecha) {
  const { rows } = await pool.query(
    `SELECT id_vigencia, vigente_desde, vigente_hasta, motivo, creado_en
       FROM vigencias_escala_antiguedad
      WHERE vigente_desde <= $1 AND (vigente_hasta IS NULL OR vigente_hasta >= $1)`,
    [fecha]
  );
  return rows[0];
}

async function ultimaVigencia(cliente) {
  const { rows } = await cliente.query(
    "SELECT id_vigencia, vigente_desde, vigente_hasta FROM vigencias_escala_antiguedad " +
      "ORDER BY vigente_desde DESC LIMIT 1 FOR UPDATE"
  );
  return rows[0];
}

async function cerrarVigencia(cliente, idVigencia, hasta) {
  await cliente.query("UPDATE vigencias_escala_antiguedad SET vigente_hasta = $1 WHERE id_vigencia = $2", [
    hasta,
    idVigencia,
  ]);
}

async function crearVigencia(cliente, { vigente_desde, motivo }) {
  const { rows } = await cliente.query(
    "INSERT INTO vigencias_escala_antiguedad (vigente_desde, motivo) VALUES ($1, $2) RETURNING id_vigencia",
    [vigente_desde, motivo]
  );
  return rows[0].id_vigencia;
}

async function crearTramos(cliente, idVigencia, tramos) {
  for (const tramo of tramos) {
    await cliente.query(
      "INSERT INTO tramos_antiguedad (id_vigencia, anios_desde, anios_hasta, porcentaje) VALUES ($1, $2, $3, $4)",
      [idVigencia, tramo.anios_desde, tramo.anios_hasta, tramo.porcentaje]
    );
  }
}

module.exports = {
  listarVigencias,
  listarTramos,
  obtenerVigenciaEnFecha,
  ultimaVigencia,
  cerrarVigencia,
  crearVigencia,
  crearTramos,
};
