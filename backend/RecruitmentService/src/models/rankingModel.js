const pool = require("../../db/pool");

/**
 * Genera la cláusula SQL para el ordenamiento de desempate secundario.
 * @param {string} criterio - 'experiencia' | 'fecha_postulacion' | 'educacion'
 * @param {string} direccion - 'ASC' | 'DESC'
 */
function construirClausulaDesempate(criterio, direccion) {
  const dir = direccion.toUpperCase() === "ASC" ? "ASC" : "DESC";

  switch (criterio) {
    case "experiencia":
      return `anios_experiencia ${dir}, p.fecha_postulacion ASC`;
    case "fecha_postulacion":
      return `p.fecha_postulacion ${dir}`;
    case "educacion":
      return `nivel_educacion_orden ${dir}, anios_experiencia DESC, p.fecha_postulacion ASC`;
    default:
      return `anios_experiencia DESC, p.fecha_postulacion ASC`;
  }
}

const rankingModel = {
  /**
   * Obtiene la lista de postulantes clasificados con cálculo de afinidad,
   * criterios de desempate y filtros de visualización en base de datos.
   *
   * @param {string} idConvocatoria - UUID de la convocatoria.
   * @param {Object} filtros - Criterios de filtrado y ordenamiento.
   * @returns {Promise<{ postulantes: Array, totalRegistros: number }>}
   */
  async obtenerRankingPorConvocatoria(idConvocatoria, filtros = {}) {
    const {
      desempate = "experiencia",
      orden_desempate = "desc",
      experiencia_min = null,
      pretension_salarial_max = null,
      etapa = null,
      ciudad = null,
      pagina = 1,
      limite = 10,
    } = filtros;

    const offset = (pagina - 1) * limite;
    const clausulaDesempate = construirClausulaDesempate(
      desempate,
      orden_desempate,
    );

    const baseCte = `
      WITH PostulantesEvaluados AS (
        SELECT 
          p.id_postulacion,
          p.id_convocatoria,
          p.fecha_postulacion,
          COALESCE(
            p.score_afinidad,
            (p.datos_extraidos_cv->>'scoreMatching')::numeric,
            0
          ) AS score_afinidad,
          COALESCE(
            (p.datos_extraidos_cv->>'aniosExperienciaEstimados')::numeric,
            0
          ) AS anios_experiencia,
          COALESCE(
            (p.datos_extraidos_cv->>'pretensionSalarial')::numeric,
            NULL
          ) AS pretension_salarial,
          CASE 
            WHEN UPPER(p.datos_extraidos_cv->>'nivelEducacionMaximo') LIKE '%DOCTORADO%' THEN 6
            WHEN UPPER(p.datos_extraidos_cv->>'nivelEducacionMaximo') LIKE '%MAESTR%' THEN 5
            WHEN UPPER(p.datos_extraidos_cv->>'nivelEducacionMaximo') LIKE '%LICENCIATURA%' THEN 4
            WHEN UPPER(p.datos_extraidos_cv->>'nivelEducacionMaximo') LIKE '%SUPERIOR%' THEN 3
            WHEN UPPER(p.datos_extraidos_cv->>'nivelEducacionMaximo') LIKE '%MEDIO%' THEN 2
            WHEN UPPER(p.datos_extraidos_cv->>'nivelEducacionMaximo') LIKE '%BACHILLER%' THEN 1
            ELSE 0
          END AS nivel_educacion_orden,
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
      )
    `;

    const condiciones = ["1=1"];
    const valores = [idConvocatoria];
    let indice = 2;

    if (experiencia_min !== null) {
      condiciones.push(`anios_experiencia >= $${indice}`);
      valores.push(experiencia_min);
      indice++;
    }

    if (pretension_salarial_max !== null) {
      condiciones.push(
        `(pretension_salarial IS NULL OR pretension_salarial <= $${indice})`,
      );
      valores.push(pretension_salarial_max);
      indice++;
    }

    if (etapa) {
      condiciones.push(
        `(UPPER(nombre_etapa) = UPPER($${indice}) OR id_etapa::text = $${indice})`,
      );
      valores.push(etapa);
      indice++;
    }

    if (ciudad) {
      condiciones.push(`LOWER(ciudad) = LOWER($${indice})`);
      valores.push(ciudad);
      indice++;
    }

    const whereFiltros = condiciones.join(" AND ");

    const sqlCount = `
      ${baseCte}
      SELECT COUNT(*) AS total
      FROM PostulantesEvaluados
      WHERE ${whereFiltros};
    `;
    const countResult = await pool.query(sqlCount, valores);
    const totalRegistros = parseInt(countResult.rows[0]?.total || 0, 10);

    const sqlQuery = `
      ${baseCte}
      SELECT 
        ROW_NUMBER() OVER (
          ORDER BY 
            score_afinidad DESC,
            ${clausulaDesempate}
        ) AS posicion_ranking,
        *
      FROM PostulantesEvaluados
      WHERE ${whereFiltros}
      ORDER BY posicion_ranking ASC
      LIMIT $${indice} OFFSET $${indice + 1};
    `;

    const valoresQuery = [...valores, limite, offset];
    const { rows } = await pool.query(sqlQuery, valoresQuery);

    const postulantesFormateados = rows.map((fila) => ({
      posicion_ranking: parseInt(fila.posicion_ranking, 10),
      id_postulacion: fila.id_postulacion,
      id_convocatoria: fila.id_convocatoria,
      fecha_postulacion: fila.fecha_postulacion,
      score_afinidad: parseFloat(Number(fila.score_afinidad).toFixed(2)),
      anios_experiencia: parseFloat(Number(fila.anios_experiencia).toFixed(1)),
      pretension_salarial: fila.pretension_salarial
        ? parseFloat(fila.pretension_salarial)
        : null,
      cv_archivo_url: fila.cv_archivo_url,
      id_postulante: fila.id_postulante,
      numero_documento: fila.numero_documento,
      nombres: fila.nombres,
      apellidos: fila.apellidos,
      correo_electronico: fila.correo_electronico,
      telefono_contacto: fila.telefono_contacto,
      ciudad: fila.ciudad,
      id_etapa: fila.id_etapa,
      nombre_etapa: fila.nombre_etapa,
    }));

    return {
      postulantes: postulantesFormateados,
      totalRegistros,
    };
  },
};

module.exports = rankingModel;
