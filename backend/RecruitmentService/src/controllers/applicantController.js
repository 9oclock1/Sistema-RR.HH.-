const applicantService = require("../services/applicantService");
const { ErrorApp } = require("../utils/errores");

/**
 * Controller: ApplicantController
 * HTTP handlers for RF-09: Applicant Registration.
 * Delegates all business logic to applicantService and forwards errors to manejadorErrores.
 */

function traducirErrorBD(error) {
  if (error instanceof ErrorApp) return error;

  if (error.code === "23505") {
    if (error.constraint === "uq_postulacion_convocatoria_postulante") {
      return new ErrorApp(409, "El postulante ya se encuentra registrado en esta convocatoria.");
    }
    if (error.constraint === "uq_postulante_correo") {
      return new ErrorApp(409, "El correo electrónico ya se encuentra registrado con otro postulante.");
    }
    return new ErrorApp(409, "Registro duplicado en la base de datos.");
  }

  if (error.code === "23503") {
    return new ErrorApp(400, "Referencia inválida. Verifique que la convocatoria y la etapa existan.");
  }

  if (error.code === "22P02") {
    return new ErrorApp(400, "Formato de identificador o dato inválido.");
  }

  return error;
}

/**
 * POST /applicants/register
 * Registers a new applicant for a job opening.
 */
async function registerApplicant(req, res, next) {
  try {
    const result = await applicantService.registerApplicant(req.body);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    next(traducirErrorBD(error));
  }
}

/**
 * GET /applicants/by-opening/:id_convocatoria
 * Lists all applicants for a specific job opening.
 */
async function getApplicantsByJobOpening(req, res, next) {
  try {
    const { id_convocatoria } = req.params;

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id_convocatoria)) {
      throw new ErrorApp(400, "El ID de la convocatoria no tiene un formato UUID válido.");
    }

    const result = await applicantService.getApplicantsByJobOpening(id_convocatoria);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    next(traducirErrorBD(error));
  }
}

/**
 * GET /applicants/job-openings
 * Returns all active job openings (for the dropdown selector).
 */
async function getActiveJobOpenings(req, res, next) {
  try {
    const result = await applicantService.getActiveJobOpenings();
    return res.status(result.statusCode).json(result);
  } catch (error) {
    next(traducirErrorBD(error));
  }
}

module.exports = {
  registerApplicant,
  getApplicantsByJobOpening,
  getActiveJobOpenings,
};
