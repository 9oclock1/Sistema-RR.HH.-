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
 * @param {Object} [dbClient=pool] - Optional client for transaction support
 * @returns {Object} The created applicant row
 */
async function createApplicant(data, dbClient = pool) {
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
    direccion_residencia && String(direccion_residencia).trim() !== ""
      ? String(direccion_residencia).trim()
      : null,
    ciudad && String(ciudad).trim() !== ""
      ? String(ciudad).trim()
      : "La Paz",
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
}

/**
 * Finds an applicant by their document number.
 * @param {string} numero_documento
 * @param {Object} [dbClient=pool]
 * @returns {Object|null} The applicant row or null
 */
async function findByDocumentNumber(numero_documento, dbClient = pool) {
  if (numero_documento === undefined || numero_documento === null) return null;
  const query = `
    SELECT * FROM POSTULANTES
    WHERE numero_documento = $1;
  `;
  const result = await dbClient.query(query, [String(numero_documento).trim()]);
  return result.rows[0] || null;
}

/**
 * Finds an applicant by their UUID.
 * @param {string} id_postulante
 * @param {Object} [dbClient=pool]
 * @returns {Object|null}
 */
async function findById(id_postulante, dbClient = pool) {
  const query = `SELECT * FROM POSTULANTES WHERE id_postulante = $1;`;
  const result = await dbClient.query(query, [id_postulante]);
  return result.rows[0] || null;
}

/**
 * Finds an applicant by their email address.
 * @param {string} correo_electronico
 * @param {Object} [dbClient=pool]
 * @returns {Object|null}
 */
async function findByEmail(correo_electronico, dbClient = pool) {
  if (!correo_electronico) return null;
  const query = `
    SELECT * FROM POSTULANTES
    WHERE correo_electronico = $1;
  `;
  const result = await dbClient.query(query, [
    String(correo_electronico).trim().toLowerCase(),
  ]);
  return result.rows[0] || null;
}

/**
 * Updates an existing applicant's profile data without overwriting
 * existing details with empty or undefined fields.
 * If the applicant already has a saved city, address, phone, etc.,
 * and the subsequent form leaves it empty, the existing values are preserved.
 *
 * @param {string} id_postulante
 * @param {Object} data - Fields to update
 * @param {Object} [dbClient=pool] - Optional client for transaction support
 * @returns {Object} The updated applicant row
 */
async function updateApplicant(id_postulante, data, dbClient = pool) {
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
      nombres = COALESCE(NULLIF(TRIM($2), ''), nombres),
      apellidos = COALESCE(NULLIF(TRIM($3), ''), apellidos),
      correo_electronico = COALESCE(NULLIF(TRIM($4), ''), correo_electronico),
      telefono_contacto = COALESCE(NULLIF(TRIM($5), ''), telefono_contacto),
      direccion_residencia = COALESCE(NULLIF(TRIM($6), ''), direccion_residencia),
      ciudad = COALESCE(NULLIF(TRIM($7), ''), ciudad)
    WHERE id_postulante = $1
    RETURNING *;
  `;

  const values = [
    id_postulante,
    nombres !== undefined && nombres !== null ? String(nombres).trim() : null,
    apellidos !== undefined && apellidos !== null ? String(apellidos).trim() : null,
    correo_electronico !== undefined && correo_electronico !== null
      ? String(correo_electronico).trim().toLowerCase()
      : null,
    telefono_contacto !== undefined && telefono_contacto !== null
      ? String(telefono_contacto).trim()
      : null,
    direccion_residencia !== undefined && direccion_residencia !== null
      ? String(direccion_residencia).trim()
      : null,
    ciudad !== undefined && ciudad !== null ? String(ciudad).trim() : null,
  ];

  const result = await dbClient.query(query, values);
  return result.rows[0];
}

module.exports = {
  createApplicant,
  findByDocumentNumber,
  findById,
  findByEmail,
  updateApplicant,
};
