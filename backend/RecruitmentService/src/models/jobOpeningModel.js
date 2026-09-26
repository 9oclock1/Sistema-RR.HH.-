const pool = require("../config/database");

/**
 * Model: CONVOCATORIAS
 * Read-only operations for job openings.
 * RF-09 only needs to query openings to associate applicants;
 * creating/managing openings is handled by other functional requirements.
 */

/**
 * Retrieves all active job openings.
 * @returns {Array}
 */
async function findAllActive() {
  const query = `
    SELECT 
      id_convocatoria,
      codigo_convocatoria,
      titulo_puesto,
      descripcion_puesto,
      cantidad_vacantes,
      fecha_publicacion,
      fecha_limite_postulacion,
      esta_activa
    FROM CONVOCATORIAS
    WHERE esta_activa = TRUE
    ORDER BY fecha_publicacion DESC;
  `;
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Retrieves a single job opening by its UUID.
 * @param {string} id_convocatoria
 * @returns {Object|null}
 */
async function findById(id_convocatoria) {
  const query = `
    SELECT * FROM CONVOCATORIAS WHERE id_convocatoria = $1;
  `;
  const result = await pool.query(query, [id_convocatoria]);
  return result.rows[0] || null;
}

module.exports = {
  findAllActive,
  findById,
};
