const pool = require("../config/database");
const applicantModel = require("../models/applicantModel");
const applicationModel = require("../models/applicationModel");
const jobOpeningModel = require("../models/jobOpeningModel");

/**
 * Service: ApplicantService
 * Business logic for RF-09: Applicant Registration.
 *
 * Encapsulates the core business rules:
 *  1. Job opening must exist and be active (and not past application deadline)
 *  2. Create or reuse applicant (by documento)
 *  3. Detect duplicates (same documento → same convocatoria)
 *  4. Create the application association (POSTULACIONES)
 *  5. Ensure all database writes are wrapped in an ACID transaction so
 *     failures never leave orphan POSTULANTES rows
 */

/**
 * Registers an applicant for a job opening.
 * Handles all business rules for RF-09.
 *
 * @param {Object} data - The full registration payload
 * @returns {Object} { success, data/message, statusCode }
 */
async function registerApplicant(data) {
  const {
    id_convocatoria,
    numero_documento,
    nombres,
    apellidos,
    correo_electronico,
    telefono_contacto,
    direccion_residencia,
    ciudad,
  } = data;

  // 1. Verify the job opening exists and is currently accepting applications
  //    Business Rule (The Lock):
  //    Must be open/active AND current date must not exceed the deadline (fecha_limite_postulacion >= CURRENT_DATE).
  const convocatoria = await jobOpeningModel.findById(id_convocatoria);
  if (!convocatoria) {
    return {
      success: false,
      statusCode: 404,
      message: "La convocatoria especificada no existe.",
      error: "La convocatoria especificada no existe.",
    };
  }

  // Evaluate the lock:
  // If acepta_postulaciones was computed in SQL, use it; fallback to JS evaluation in America/La_Paz
  const fechaLimite = convocatoria.fecha_limite_postulacion
    ? (convocatoria.fecha_limite_postulacion instanceof Date
        ? convocatoria.fecha_limite_postulacion.toISOString().split("T")[0]
        : String(convocatoria.fecha_limite_postulacion).split("T")[0])
    : null;
  const hoyLaPaz = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  const isAccepting =
    convocatoria.acepta_postulaciones !== undefined
      ? Boolean(convocatoria.acepta_postulaciones)
      : Boolean(convocatoria.esta_activa) && (!fechaLimite || fechaLimite >= hoyLaPaz);

  if (!isAccepting) {
    return {
      success: false,
      statusCode: 400,
      message:
        "Esta convocatoria ya no acepta postulaciones (no se encuentra activa o su fecha límite ha vencido).",
      error:
        "Esta convocatoria ya no acepta postulaciones (no se encuentra activa o su fecha límite ha vencido).",
      data: {
        id_convocatoria: convocatoria.id_convocatoria,
        esta_activa: convocatoria.esta_activa,
        fecha_limite_postulacion: convocatoria.fecha_limite_postulacion,
      },
    };
  }

  // 2. Concurrency-safe transaction
  //    Guarantees atomicity and prevents duplicate applicants under concurrent requests.
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Concurrency protection: serialize operations on the same document number
    // using PostgreSQL transaction-level advisory lock.
    // This prevents race conditions where 20 requests with the same document number
    // arrive simultaneously and create 20 duplicate applicants in POSTULANTES.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1));", [
      "postulante_doc_" + String(numero_documento).trim(),
    ]);

    // Check if applicant already exists by document number INSIDE transaction
    let applicant = await applicantModel.findByDocumentNumber(numero_documento, client);

    if (applicant) {
      // 3. Duplicate detection: same document → same convocatoria
      const existingApplication =
        await applicationModel.findByConvocatoriaAndPostulante(
          id_convocatoria,
          applicant.id_postulante,
          client
        );

      if (existingApplication) {
        await client.query("ROLLBACK");
        return {
          success: false,
          statusCode: 409,
          message: `El postulante con documento "${numero_documento}" ya se encuentra registrado en esta convocatoria.`,
          error: `El postulante con documento "${numero_documento}" ya se encuentra registrado en esta convocatoria.`,
          data: {
            id_postulante: applicant.id_postulante,
            numero_documento: applicant.numero_documento,
            nombres: applicant.nombres,
            apellidos: applicant.apellidos,
            fecha_postulacion: existingApplication.fecha_postulacion,
          },
        };
      }

      // Check if provided email belongs to ANOTHER applicant with a different document number
      if (correo_electronico) {
        const existingByEmail = await applicantModel.findByEmail(correo_electronico, client);
        if (existingByEmail && existingByEmail.id_postulante !== applicant.id_postulante) {
          await client.query("ROLLBACK");
          return {
            success: false,
            statusCode: 409,
            message: `El correo electrónico "${correo_electronico}" ya se encuentra registrado con otro número de documento.`,
            error: `El correo electrónico "${correo_electronico}" ya se encuentra registrado con otro número de documento.`,
          };
        }
      }

      // IMPORTANT: Do NOT overwrite existing applicant's profile (names, phone, etc.).
      // Re-applying to another opening reuses the existing canonical applicant record
      // without mutating POSTULANTES, preventing data corruption of historical applications.
    } else {
      // Check email uniqueness before creating new applicant
      const existingByEmail = await applicantModel.findByEmail(correo_electronico, client);
      if (existingByEmail) {
        await client.query("ROLLBACK");
        return {
          success: false,
          statusCode: 409,
          message: `El correo electrónico "${correo_electronico}" ya se encuentra registrado con otro número de documento.`,
          error: `El correo electrónico "${correo_electronico}" ya se encuentra registrado con otro número de documento.`,
        };
      }

      // Create new applicant
      applicant = await applicantModel.createApplicant(
        {
          numero_documento,
          nombres,
          apellidos,
          correo_electronico,
          telefono_contacto,
          direccion_residencia,
          ciudad,
        },
        client
      );
    }

    // 4. Create the application (association between applicant ↔ convocatoria)
    //    Default stage id_etapa = 1 (first stage in the workflow)
    //    cv_archivo_url defaults to "pending" until document upload module is integrated
    const application = await applicationModel.createApplication(
      {
        id_convocatoria,
        id_postulante: applicant.id_postulante,
        id_etapa: 1,
        cv_archivo_url: data.cv_archivo_url || "pending",
        cv_formato_mimetype: data.cv_formato_mimetype || "application/pdf",
      },
      client
    );

    await client.query("COMMIT");

    return {
      success: true,
      statusCode: 201,
      message: "Postulante registrado exitosamente.",
      data: {
        postulante: {
          id_postulante: applicant.id_postulante,
          numero_documento: applicant.numero_documento,
          nombres: applicant.nombres,
          apellidos: applicant.apellidos,
          correo_electronico: applicant.correo_electronico,
          telefono_contacto: applicant.telefono_contacto,
          direccion_residencia: applicant.direccion_residencia,
          ciudad: applicant.ciudad,
        },
        postulacion: {
          id_postulacion: application.id_postulacion,
          id_convocatoria: application.id_convocatoria,
          fecha_postulacion: application.fecha_postulacion,
        },
      },
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Retrieves all applicants for a specific job opening.
 * Returns the list with their application dates.
 *
 * @param {string} id_convocatoria
 * @returns {Object}
 */
async function getApplicantsByJobOpening(id_convocatoria) {
  // Verify the job opening exists
  const convocatoria = await jobOpeningModel.findById(id_convocatoria);
  if (!convocatoria) {
    return {
      success: false,
      statusCode: 404,
      message: "La convocatoria especificada no existe.",
      error: "La convocatoria especificada no existe.",
    };
  }

  const applicants = await applicationModel.findByConvocatoria(id_convocatoria);

  return {
    success: true,
    statusCode: 200,
    data: {
      convocatoria: {
        id_convocatoria: convocatoria.id_convocatoria,
        codigo_convocatoria: convocatoria.codigo_convocatoria,
        titulo_puesto: convocatoria.titulo_puesto,
      },
      total_postulantes: applicants.length,
      postulantes: applicants,
    },
  };
}

/**
 * Retrieves all active job openings (for dropdown selection).
 * @returns {Object}
 */
async function getActiveJobOpenings() {
  const openings = await jobOpeningModel.findAllActive();
  return {
    success: true,
    statusCode: 200,
    data: openings,
  };
}

module.exports = {
  registerApplicant,
  getApplicantsByJobOpening,
  getActiveJobOpenings,
};
