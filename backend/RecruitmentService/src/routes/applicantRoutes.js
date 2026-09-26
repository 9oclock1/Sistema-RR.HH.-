const express = require("express");
const router = express.Router();
const applicantController = require("../controllers/applicantController");
const {
  validateApplicantRegistration,
} = require("../middlewares/validationMiddleware");

/**
 * Routes: RF-09 Applicant Registration
 *
 * All routes are relative to the mount point in index.js.
 * The nginx gateway proxies /api/recr/ → recruitment-service:3003/
 * so these endpoints will be available at:
 *   POST /api/recr/applicants/register
 *   GET  /api/recr/applicants/by-opening/:id_convocatoria
 *   GET  /api/recr/applicants/job-openings
 */

// Register a new applicant for a job opening
router.post(
  "/register",
  validateApplicantRegistration,
  applicantController.registerApplicant
);

// List all applicants for a specific job opening
router.get(
  "/by-opening/:id_convocatoria",
  applicantController.getApplicantsByJobOpening
);

// Get all active job openings (for dropdown/select)
router.get("/job-openings", applicantController.getActiveJobOpenings);

module.exports = router;
