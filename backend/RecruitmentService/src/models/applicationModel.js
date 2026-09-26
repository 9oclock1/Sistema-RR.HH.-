const pool = require("../config/database");
const { v4: uuidv4 } = require("uuid");

/**
 * Model: POSTULACIONES
 * Handles CRUD operations for the applications (postulaciones) table.
 * Maps directly to the POSTULACIONES schema defined in db/init.sql.
 *
 * KEY CONSTRAINT: uq_postulacion_convocatoria_postulante
 *   UNIQUE (id_convocatoria, id_postulante)
 *   Prevents the same applicant from applying to the same job opening twice.
 */

/**
 * Creates a new application linking an applicant to a job opening.
 * @param {Object} data
 * @returns {Object} The created application row
 */
async function createApplication(data) {
  const {
    id_convocatoria,
    id_postulante,
    id_etapa,
    cv_archivo_url,
    cv_formato_mimetype,
  } = data;

  const id_postulacion = uuidv4();

  const query = `
    INSERT INTO POSTULACIONES (
      id_postulacion,
      id_convocatoria,
      id_postulante,
      id_etapa,
      cv_archivo_url,
      cv_formato_mimetype
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;

  const values = [
    id_postulacion,
    id_convocatoria,
    id_postulante,
    id_etapa,
    cv_archivo_url || "pending",
    cv_formato_mimetype || "application/pdf",
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Checks if an applicant already has a postulation for a given job opening.
 * Leverages the UNIQUE constraint (id_convocatoria, id_postulante).
 * @param {string} id_convocatoria
 * @param {string} id_postulante
 * @returns {Object|null}
 */
async function findByConvocatoriaAndPostulante(
  id_convocatoria,
  id_postulante
) {
  const query = `
    SELECT p.*, pos.nombres, pos.apellidos, pos.numero_documento
    FROM POSTULACIONES p
    JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
    WHERE p.id_convocatoria = $1 AND p.id_postulante = $2;
  `;
  const result = await pool.query(query, [id_convocatoria, id_postulante]);
  return result.rows[0] || null;
}

/**
 * Retrieves all applicants associated with a given job opening,
 * ordered by application date (most recent first).
 * @param {string} id_convocatoria
 * @returns {Array}
 */
async function findByConvocatoria(id_convocatoria) {
  const query = `
    SELECT 
      p.id_postulacion,
      p.id_convocatoria,
      p.fecha_postulacion,
      p.id_etapa,
      pos.id_postulante,
      pos.numero_documento,
      pos.nombres,
      pos.apellidos,
      pos.correo_electronico,
      pos.telefono_contacto,
      pos.direccion_residencia,
      pos.ciudad,
      cep.nombre AS nombre_etapa
    FROM POSTULACIONES p
    JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
    LEFT JOIN CATALOGOS_ETAPA_POSTULACION cep ON cep.id_etapa = p.id_etapa
    WHERE p.id_convocatoria = $1
    ORDER BY p.fecha_postulacion DESC;
  `;
  const result = await pool.query(query, [id_convocatoria]);
  return result.rows;
}

module.exports = {
  createApplication,
  findByConvocatoriaAndPostulante,
  findByConvocatoria,
};
