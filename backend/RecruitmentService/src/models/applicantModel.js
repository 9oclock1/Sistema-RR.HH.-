const pool = require("../config/database");
const { v4: uuidv4 } = require("uuid");

/**
 * Model: POSTULANTES
 * Handles CRUD operations for the applicants (postulantes) table.
 * Maps directly to the POSTULANTES schema defined in db/init.sql.
 */

/**
 * Creates a new applicant record.
 * @param {Object} data - Applicant personal information
 * @returns {Object} The created applicant row
 */
async function createApplicant(data) {
  const {
    numero_documento,
    nombres,
    apellidos,
    correo_electronico,
    telefono_contacto,
    direccion_residencia,
    ciudad,
  } = data;

  const id_postulante = uuidv4();

  const query = `
    INSERT INTO POSTULANTES (
      id_postulante,
      numero_documento,
      nombres,
      apellidos,
      correo_electronico,
      telefono_contacto,
      direccion_residencia,
      ciudad
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *;
  `;

  const values = [
    id_postulante,
    String(numero_documento).trim(),
    String(nombres).trim(),
    String(apellidos).trim(),
    String(correo_electronico).trim().toLowerCase(),
    String(telefono_contacto).trim(),
    direccion_residencia ? String(direccion_residencia).trim() : null,
    ciudad ? String(ciudad).trim() : "La Paz",
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

/**
 * Finds an applicant by their document number.
 * @param {string} numero_documento
 * @returns {Object|null} The applicant row or null
 */
async function findByDocumentNumber(numero_documento) {
  if (numero_documento === undefined || numero_documento === null) return null;
  const query = `
    SELECT * FROM POSTULANTES
    WHERE numero_documento = $1;
  `;
  const result = await pool.query(query, [String(numero_documento).trim()]);
  return result.rows[0] || null;
}

/**
 * Finds an applicant by their UUID.
 * @param {string} id_postulante
 * @returns {Object|null}
 */
async function findById(id_postulante) {
  const query = `SELECT * FROM POSTULANTES WHERE id_postulante = $1;`;
  const result = await pool.query(query, [id_postulante]);
  return result.rows[0] || null;
}

/**
 * Finds an applicant by their email address.
 * @param {string} correo_electronico
 * @returns {Object|null}
 */
async function findByEmail(correo_electronico) {
  const query = `
    SELECT * FROM POSTULANTES
    WHERE correo_electronico = $1;
  `;
  const result = await pool.query(query, [
    correo_electronico.trim().toLowerCase(),
  ]);
  return result.rows[0] || null;
}

/**
 * Updates an existing applicant's profile data.
 * Used when a returning applicant applies to a new vacancy with updated info.
 * @param {string} id_postulante
 * @param {Object} data - Fields to update
 * @returns {Object} The updated applicant row
 */
async function updateApplicant(id_postulante, data) {
  const {
    nombres,
    apellidos,
    correo_electronico,
    telefono_contacto,
    direccion_residencia,
    ciudad,
  } = data;

  const query = `
    UPDATE POSTULANTES SET
      nombres = $2,
      apellidos = $3,
      correo_electronico = $4,
      telefono_contacto = $5,
      direccion_residencia = $6,
      ciudad = $7
    WHERE id_postulante = $1
    RETURNING *;
  `;

  const values = [
    id_postulante,
    String(nombres).trim(),
    String(apellidos).trim(),
    String(correo_electronico).trim().toLowerCase(),
    String(telefono_contacto).trim(),
    direccion_residencia ? String(direccion_residencia).trim() : null,
    ciudad ? String(ciudad).trim() : "La Paz",
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

module.exports = {
  createApplicant,
  findByDocumentNumber,
  findById,
  findByEmail,
  updateApplicant,
};
