import cliente, { solicitar } from "./cliente";

const BASE_RECRUITMENT = "/recr";

export const postulacionApi = {
  // Listado de RF-08; los borradores todavía no reciben postulaciones.
  async obtenerConvocatorias() {
    const convocatorias = await cliente.get(`${BASE_RECRUITMENT}/convocatorias`);
    return convocatorias.filter((c) => c.estado !== "borrador");
  },

  async obtenerPostulantesPorConvocatoria(idConvocatoria) {
    const res = await cliente.get(
      `${BASE_RECRUITMENT}/convocatorias/${idConvocatoria}/postulantes`,
    );
    return res.data;
  },

  /**
   * Envía la postulación con el archivo CV adjunto (multipart/form-data)
   * @param {Object} params
   * @param {string} params.idConvocatoria - UUID de la vacante
   * @param {string} params.idPostulante - UUID del postulante
   * @param {File} params.archivoCv - Objeto File del CV (PDF o DOCX)
   */
  async registrarPostulacionConCv({ idConvocatoria, idPostulante, archivoCv }) {
    const formData = new FormData();
    formData.append("idConvocatoria", idConvocatoria);
    formData.append("idPostulante", idPostulante);
    formData.append("cv", archivoCv);

    return await cliente.post(`${BASE_RECRUITMENT}/postulaciones`, formData);
  },

  /**
   * Retorna la URL directa para visualizar o descargar el archivo a través del Gateway
   * @param {string} idPostulacion - UUID de la postulación
   * @param {boolean} [forzarDescarga=false] - true para forzar descarga directa, false para inline
   * @returns {string} URL pública accesible desde el navegador
   */
  obtenerUrlCv(idPostulacion, forzarDescarga = false) {
    const apiBase = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");
    const downloadParam = forzarDescarga ? "?download=true" : "";
    return `${apiBase}${BASE_RECRUITMENT}/postulaciones/${idPostulacion}/cv${downloadParam}`;
  },

  /**
   * Descarga el archivo vía Blob para manejar nombres limpios
   * @param {string} idPostulacion - UUID de la postulación
   * @param {string} [nombreSugerido="Curriculum_Vitae"]
   */
  async descargarCvBlob(idPostulacion, nombreSugerido = "Curriculum_Vitae") {
    const blob = await solicitar(
      `${BASE_RECRUITMENT}/postulaciones/${idPostulacion}/cv?download=true`,
      { respuestaBinaria: true },
    );

    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.setAttribute("download", nombreSugerido);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(blobUrl);
  },

  async adjuntarCvAPostulacion(idPostulacion, archivoCv) {
    const formData = new FormData();
    formData.append("cv", archivoCv);

    return await cliente.patch(
      `${BASE_RECRUITMENT}/postulaciones/${idPostulacion}/cv`,
      formData,
    );
  },
};
