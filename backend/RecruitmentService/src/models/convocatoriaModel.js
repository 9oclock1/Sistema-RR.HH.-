import { pool } from "../config/dbConfig.js";

export const ConvocatoriaModel = {
  async listarActivas() {
    const query = `
      SELECT 
        id_convocatoria, 
        codigo_convocatoria, 
        titulo_puesto, 
        descripcion_puesto, 
        cantidad_vacantes, 
        esta_activa
      FROM CONVOCATORIAS
      WHERE esta_activa = TRUE
      ORDER BY fecha_publicacion DESC;
    `;
    const { rows } = await pool.query(query);
    return rows;
  },

  async listarPostulantesPorConvocatoria(idConvocatoria) {
    const query = `
      SELECT 
        p.id_postulacion,
        p.id_convocatoria,
        p.cv_archivo_url,
        p.cv_formato_mimetype,
        p.fecha_postulacion,
        pos.id_postulante,
        pos.numero_documento,
        pos.nombres,
        pos.apellidos,
        pos.correo_electronico,
        pos.telefono_contacto,
        cep.nombre as etapa_actual
      FROM POSTULACIONES p
      INNER JOIN POSTULANTES pos 
        ON pos.id_postulante = p.id_postulante
      LEFT JOIN CATALOGOS_ETAPA_POSTULACION cep 
        ON cep.id_etapa = p.id_etapa
      WHERE p.id_convocatoria = $1
      ORDER BY pos.apellidos ASC;
    `;
    const { rows } = await pool.query(query, [idConvocatoria]);
    return rows;
  },
};
