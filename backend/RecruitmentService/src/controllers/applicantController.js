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
        return res.status(409).json({
          success: false,
          message:
            "El postulante ya se encuentra registrado en esta convocatoria.",
        });
      }
      if (error.constraint === "uq_postulante_correo") {
        return res.status(409).json({
          success: false,
          message: "El correo electrónico ya se encuentra registrado.",
        });
      }
    }

    // Handle FK violations (e.g., invalid id_etapa)
    if (error.code === "23503") {
      return res.status(400).json({
        success: false,
        message:
          "Referencia inválida. Verifique que la convocatoria y la etapa existan.",
      });
    }

    // Handle invalid UUID or data syntax (PostgreSQL 22P02)
    if (error.code === "22P02") {
      return res.status(400).json({
        success: false,
        message: "Formato de identificador o dato inválido.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al registrar el postulante.",
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
      return res.status(400).json({
        success: false,
        message: "El ID de la convocatoria no tiene un formato UUID válido.",
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
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener los postulantes.",
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
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor al obtener las convocatorias.",
    });
  }
}

module.exports = {
  registerApplicant,
  getApplicantsByJobOpening,
  getActiveJobOpenings,
};
