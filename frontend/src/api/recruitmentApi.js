import { solicitar, ErrorApi } from "./cliente";

const RUTA_BASE = "/recr/applicants";

/**
 * Normaliza los errores lanzados por la API para mantener compatibilidad
 * con la convención del sistema (ErrorApi con `estado` y `detalles`) y
 * con el código anterior de postulantes (`status` y `errors`).
 */
function adaptarError(error) {
  if (error instanceof ErrorApi) {
    error.status = error.estado;
    error.detalles = Array.isArray(error.detalles) ? error.detalles : [];
    error.errors = error.detalles;
  }
  return error;
}

/**
 * Obtiene todas las convocatorias activas para el selector.
 * @returns {Promise<Array>} Lista de convocatorias
 */
export async function fetchActiveJobOpenings() {
  try {
    const respuesta = await solicitar(`${RUTA_BASE}/job-openings`);
    return respuesta?.data ?? respuesta ?? [];
  } catch (error) {
    throw adaptarError(error);
  }
}

/**
 * Registra un nuevo postulante y su postulación a una convocatoria.
 * @param {Object} applicantData - Datos personales y de contacto del postulante
 * @returns {Promise<Object>} Respuesta con mensaje y datos de la postulación
 */
export async function registerApplicant(applicantData) {
  try {
    return await solicitar(`${RUTA_BASE}/register`, {
      metodo: "POST",
      cuerpo: applicantData,
    });
  } catch (error) {
    throw adaptarError(error);
  }
}

/**
 * Obtiene la lista de postulantes de una convocatoria específica.
 * @param {string} id_convocatoria - UUID de la convocatoria
 * @returns {Promise<Object>} { convocatoria, total_postulantes, postulantes }
 */
export async function fetchApplicantsByJobOpening(id_convocatoria) {
  try {
    const respuesta = await solicitar(`${RUTA_BASE}/by-opening/${id_convocatoria}`);
    return respuesta?.data ?? respuesta ?? { postulantes: [] };
  } catch (error) {
    throw adaptarError(error);
  }
}

// Alias en español para coherencia con el diseño del sistema
export const listarConvocatoriasActivas = fetchActiveJobOpenings;
export const registrarPostulante = registerApplicant;
export const listarPostulantesPorConvocatoria = fetchApplicantsByJobOpening;
