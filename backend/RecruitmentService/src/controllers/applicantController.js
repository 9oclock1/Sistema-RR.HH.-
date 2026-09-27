const applicantService = require("../services/applicantService");

/**
 * Controller: ApplicantController
 * HTTP handlers for RF-09: Applicant Registration.
 * Delegates all business logic to applicantService.
 */

/**
 * POST /applicants/register
 * Registers a new applicant for a job opening.
 */
async function registerApplicant(req, res) {
  try {
    const result = await applicantService.registerApplicant(req.body);
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error("[ApplicantController] registerApplicant error:", error);

    // Handle DB unique constraint violations
    if (error.code === "23505") {
      // PostgreSQL unique_violation
      if (error.constraint === "uq_postulacion_convocatoria_postulante") {
        const msg = "El postulante ya se encuentra registrado en esta convocatoria.";
        return res.status(409).json({
          success: false,
          message: msg,
          error: msg,
        });
      }
      if (error.constraint === "uq_postulante_correo") {
        const msg = "El correo electrónico ya se encuentra registrado con otro postulante.";
        return res.status(409).json({
          success: false,
          message: msg,
          error: msg,
        });
      }
    }

    // Handle FK violations (e.g., invalid id_etapa)
    if (error.code === "23503") {
      const msg = "Referencia inválida. Verifique que la convocatoria y la etapa existan.";
      return res.status(400).json({
        success: false,
        message: msg,
        error: msg,
      });
    }

    // Handle invalid UUID or data syntax (PostgreSQL 22P02)
    if (error.code === "22P02") {
      const msg = "Formato de identificador o dato inválido.";
      return res.status(400).json({
        success: false,
        message: msg,
        error: msg,
      });
    }

    const msg500 = "Error interno del servidor al registrar el postulante.";
    return res.status(500).json({
      success: false,
      message: msg500,
      error: msg500,
    });
  }
}

/**
 * GET /applicants/by-opening/:id_convocatoria
 * Lists all applicants for a specific job opening.
 */
async function getApplicantsByJobOpening(req, res) {
  try {
    const { id_convocatoria } = req.params;

    // Validate UUID format
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id_convocatoria)) {
      const msg = "El ID de la convocatoria no tiene un formato UUID válido.";
      return res.status(400).json({
        success: false,
        message: msg,
        error: msg,
      });
    }

    const result = await applicantService.getApplicantsByJobOpening(
      id_convocatoria
    );
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error(
      "[ApplicantController] getApplicantsByJobOpening error:",
      error
    );
    const msg = "Error interno del servidor al obtener los postulantes.";
    return res.status(500).json({
      success: false,
      message: msg,
      error: msg,
    });
  }
}

/**
 * GET /applicants/job-openings
 * Returns all active job openings (for the dropdown selector).
 */
async function getActiveJobOpenings(req, res) {
  try {
    const result = await applicantService.getActiveJobOpenings();
    return res.status(result.statusCode).json(result);
  } catch (error) {
    console.error(
      "[ApplicantController] getActiveJobOpenings error:",
      error
    );
    const msg = "Error interno del servidor al obtener las convocatorias.";
    return res.status(500).json({
      success: false,
      message: msg,
      error: msg,
    });
  }
}

module.exports = {
  registerApplicant,
  getApplicantsByJobOpening,
  getActiveJobOpenings,
};
