/**
 * API Client for RecruitmentService — RF-09 Applicant Registration
 *
 * Uses the nginx gateway at /api/recr/ which proxies to
 * recruitment-service:3003/
 *
 * All functions return the parsed JSON response.
 * Errors are thrown with the server's message when available.
 */

const API_BASE = `${import.meta.env.VITE_API_URL || "/api"}/recr`;

/**
 * Fetches all active job openings for the dropdown selector.
 * @returns {Promise<Array>}
 */
export async function fetchActiveJobOpenings() {
  const response = await fetch(`${API_BASE}/applicants/job-openings`);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Error al obtener las convocatorias.");
  }
  return data.data;
}

/**
 * Registers a new applicant for a job opening.
 * @param {Object} applicantData - The full registration payload
 * @returns {Promise<Object>} The success response with postulante + postulacion
 */
export async function registerApplicant(applicantData) {
  const response = await fetch(`${API_BASE}/applicants/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(applicantData),
  });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.message || "Error al registrar el postulante.");
    error.status = response.status;
    error.errors = data.errors || [];
    error.data = data.data || null;
    throw error;
  }
  return data;
}

/**
 * Fetches all applicants associated with a job opening.
 * @param {string} id_convocatoria - UUID of the job opening
 * @returns {Promise<Object>} { convocatoria, total_postulantes, postulantes }
 */
export async function fetchApplicantsByJobOpening(id_convocatoria) {
  const response = await fetch(
    `${API_BASE}/applicants/by-opening/${id_convocatoria}`
  );
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || "Error al obtener los postulantes.");
  }
  return data.data;
}
