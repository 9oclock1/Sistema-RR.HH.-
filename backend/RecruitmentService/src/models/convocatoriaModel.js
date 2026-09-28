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
        pos.id_postulante,
        pos.numero_documento,
        pos.nombres,
        pos.apellidos,
        pos.correo_electronico,
        pos.telefono_contacto,
        p.id_postulacion,
        p.cv_archivo_url,
        p.cv_formato_mimetype,
        p.fecha_postulacion,
        cep.nombre as etapa_actual
      FROM POSTULANTES pos
      LEFT JOIN POSTULACIONES p 
        ON p.id_postulante = pos.id_postulante 
        AND p.id_convocatoria = $1
      LEFT JOIN CATALOGOS_ETAPA_POSTULACION cep 
        ON cep.id_etapa = p.id_etapa
      ORDER BY p.id_postulacion IS NOT NULL DESC, pos.apellidos ASC;
    `;
    const { rows } = await pool.query(query, [idConvocatoria]);
    return rows;
  },
};
