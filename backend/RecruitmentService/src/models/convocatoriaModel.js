const pool = require("../../db/pool");

const ConvocatoriaModel = {
  async listarPostulantesPorConvocatoria(
    idConvocatoria,
    { minAfinidad = null, maxAfinidad = null } = {},
  ) {
    const valores = [idConvocatoria];
    let condicionesExtra = "";

    if (minAfinidad !== null && !isNaN(Number(minAfinidad))) {
      valores.push(Number(minAfinidad));
      condicionesExtra += ` AND COALESCE(p.porcentaje_afinidad, 0) >= $${valores.length}`;
    }

    if (maxAfinidad !== null && !isNaN(Number(maxAfinidad))) {
      valores.push(Number(maxAfinidad));
      condicionesExtra += ` AND COALESCE(p.porcentaje_afinidad, 0) <= $${valores.length}`;
    }

    const query = `
      SELECT 
        p.id_postulacion,
        p.id_convocatoria,
        p.cv_archivo_url,
        p.cv_formato_mimetype,
        p.porcentaje_afinidad,
        p.posicion_ranking,
        p.datos_extraidos_cv,
        p.fecha_postulacion,
        pos.id_postulante,
        pos.numero_documento,
        pos.nombres,
        pos.apellidos,
        pos.correo_electronico,
        pos.telefono_contacto,
        pos.ciudad,
        cep.nombre as etapa_actual
      FROM POSTULACIONES p
      INNER JOIN POSTULANTES pos 
        ON pos.id_postulante = p.id_postulante
      LEFT JOIN CATALOGOS_ETAPA_POSTULACION cep 
        ON cep.id_etapa = p.id_etapa
      WHERE p.id_convocatoria = $1
      ${condicionesExtra}
      ORDER BY 
        p.posicion_ranking ASC NULLS LAST,
        p.porcentaje_afinidad DESC NULLS LAST,
        pos.apellidos ASC;
    `;
    const { rows } = await pool.query(query, valores);
    return rows;
  },
};

module.exports = { ConvocatoriaModel };
