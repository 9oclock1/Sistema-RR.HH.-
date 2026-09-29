const pool = require("../../db/pool");

const PostulacionModel = {
  async getEtapaInicial() {
    const query = `
      SELECT id_etapa 
      FROM CATALOGOS_ETAPA_POSTULACION 
      ORDER BY orden_flujo ASC 
      LIMIT 1;
    `;
    const { rows } = await pool.query(query);
    return rows.length > 0 ? rows[0].id_etapa : 1;
  },

  // verificar si ya existe una postulacion
  async existePostulacion(idConvocatoria, idPostulante) {
    const query = `
      SELECT id_postulacion 
      FROM POSTULACIONES 
      WHERE id_convocatoria = $1 AND id_postulante = $2;
    `;
    const { rows } = await pool.query(query, [idConvocatoria, idPostulante]);
    return rows.length > 0;
  },

  // Crear postulacion con cv
  async crear({
    idPostulacion,
    idConvocatoria,
    idPostulante,
    idEtapa,
    cvArchivoUrl,
    cvFormatoMimetype,
  }) {
    const query = `
      INSERT INTO POSTULACIONES (
        id_postulacion,
        id_convocatoria,
        id_postulante,
        id_etapa,
        cv_archivo_url,
        cv_formato_mimetype,
        fecha_postulacion,
        actualizado_en
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *;
    `;
    const values = [
      idPostulacion,
      idConvocatoria,
      idPostulante,
      idEtapa,
      cvArchivoUrl,
      cvFormatoMimetype,
    ];
    const { rows } = await pool.query(query, values);
    return rows[0];
  },

  // Postulacion por id
  async obtenerPorId(idPostulacion) {
    const query = `
      SELECT p.*, c.titulo_puesto, pos.nombres, pos.apellidos, pos.correo_electronico
      FROM POSTULACIONES p
      INNER JOIN CONVOCATORIAS c ON p.id_convocatoria = c.id_convocatoria
      INNER JOIN POSTULANTES pos ON p.id_postulante = pos.id_postulante
      WHERE p.id_postulacion = $1;
    `;
    const { rows } = await pool.query(query, [idPostulacion]);
    return rows[0] || null;
  },

  // Actualizar el archivo CV de una postulación existente
  async adjuntarCv(idPostulacion, { cvArchivoUrl, cvFormatoMimetype }) {
    const query = `
    UPDATE POSTULACIONES 
    SET 
      cv_archivo_url = $1,
      cv_formato_mimetype = $2,
      actualizado_en = CURRENT_TIMESTAMP
    WHERE id_postulacion = $3
    RETURNING *;
  `;
    const { rows } = await pool.query(query, [
      cvArchivoUrl,
      cvFormatoMimetype,
      idPostulacion,
    ]);
    return rows[0] || null;
  },
};

module.exports = { PostulacionModel };
