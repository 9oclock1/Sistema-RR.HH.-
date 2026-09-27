const pool = require("../config/database");

/**
 * Model: CONVOCATORIAS
 * Read-only operations for job openings.
 * RF-09 queries openings to associate applicants and check lock status.
 */

/**
 * Retrieves all active job openings whose application deadline has not expired.
 * Business rule: esta_activa = TRUE AND (fecha_limite_postulacion IS NULL OR fecha_limite_postulacion >= CURRENT_DATE)
 * @param {Object} [dbClient=pool]
 * @returns {Array}
 */
async function findAllActive(dbClient = pool) {
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
      AND (fecha_limite_postulacion IS NULL OR fecha_limite_postulacion >= CURRENT_DATE)
    ORDER BY fecha_publicacion DESC;
  `;
  const result = await dbClient.query(query);
  return result.rows;
}

/**
 * Retrieves a single job opening by its UUID, including whether it is currently
 * accepting applications based on both `esta_activa` and `fecha_limite_postulacion`.
 * @param {string} id_convocatoria
 * @param {Object} [dbClient=pool]
 * @returns {Object|null}
 */
async function findById(id_convocatoria, dbClient = pool) {
  const query = `
    SELECT 
      *,
      (CASE 
        WHEN esta_activa = TRUE AND (fecha_limite_postulacion IS NULL OR fecha_limite_postulacion >= CURRENT_DATE) THEN TRUE 
        ELSE FALSE 
      END) AS acepta_postulaciones
    FROM CONVOCATORIAS 
    WHERE id_convocatoria = $1;
  `;
  const result = await dbClient.query(query, [id_convocatoria]);
  return result.rows[0] || null;
}

module.exports = {
  findAllActive,
  findById,
};

