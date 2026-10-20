const pool = require("../../db/pool");

const rankingModel = {
  /**
   * Obtiene la lista paginada de postulantes clasificados por adecuación/matching.
   *
   * @param {string} idConvocatoria - UUID de la convocatoria.
   * @param {Object} paginacion - Opciones de paginación { pagina, limite }.
   * @returns {Promise<{ postulantes: Array, totalRegistros: number }>}
   */
  async obtenerRankingPorConvocatoria(
    idConvocatoria,
    { pagina = 1, limite = 10 } = {},
  ) {
    const offset = (pagina - 1) * limite;

    const queryCount = `
      SELECT COUNT(*) AS total
      FROM POSTULACIONES p
      WHERE p.id_convocatoria = $1;
    `;
    const countResult = await pool.query(queryCount, [idConvocatoria]);
    const totalRegistros = parseInt(countResult.rows[0]?.total || 0, 10);

    const query = `
      SELECT 
        ROW_NUMBER() OVER (
          ORDER BY 
            COALESCE(p.score_afinidad, (p.datos_extraidos_cv->>'scoreMatching')::numeric, 0) DESC,
            p.fecha_postulacion ASC
        ) AS posicion_ranking,
        p.id_postulacion,
        p.id_convocatoria,
        p.fecha_postulacion,
        COALESCE(p.score_afinidad, (p.datos_extraidos_cv->>'scoreMatching')::numeric, 0) AS score_afinidad,
        p.cv_archivo_url,
        pos.id_postulante,
        pos.numero_documento,
        pos.nombres,
        pos.apellidos,
        pos.correo_electronico,
        pos.telefono_contacto,
        pos.ciudad,
        cep.id_etapa,
        cep.nombre AS nombre_etapa
      FROM POSTULACIONES p
      INNER JOIN POSTULANTES pos 
        ON pos.id_postulante = p.id_postulante
      LEFT JOIN CATALOGOS_ETAPA_POSTULACION cep 
        ON cep.id_etapa = p.id_etapa
      WHERE p.id_convocatoria = $1
      ORDER BY posicion_ranking ASC
      LIMIT $2 OFFSET $3;
    `;

    const { rows } = await pool.query(query, [idConvocatoria, limite, offset]);

    const postulantesFormateados = rows.map((fila) => ({
      ...fila,
      posicion_ranking: parseInt(fila.posicion_ranking, 10),
      score_afinidad: parseFloat(Number(fila.score_afinidad).toFixed(2)),
    }));

    return {
      postulantes: postulantesFormateados,
      totalRegistros,
    };
  },
};

module.exports = rankingModel;
