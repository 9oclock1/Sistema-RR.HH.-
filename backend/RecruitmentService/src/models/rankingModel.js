const pool = require("../../db/pool");

/**
 * Genera la cláusula SQL del ordenamiento de desempate secundario.
 * Se ejecuta sobre el CTE PostulantesEvaluados, por eso las columnas no llevan alias de tabla.
 * @param {string} criterio - 'experiencia' | 'fecha_postulacion' | 'educacion'
 * @param {string} direccion - 'asc' | 'desc'
 */
function construirClausulaDesempate(criterio, direccion) {
  const dir = String(direccion).toUpperCase() === "ASC" ? "ASC" : "DESC";

  switch (criterio) {
    case "fecha_postulacion":
      return `fecha_postulacion ${dir}, id_postulacion ASC`;
    case "educacion":
      return `nivel_educacion_orden ${dir}, anios_experiencia DESC, fecha_postulacion ASC, id_postulacion ASC`;
    case "experiencia":
    default:
      return `anios_experiencia ${dir}, fecha_postulacion ASC, id_postulacion ASC`;
  }
}

// Mismos códigos que utils/nivelesEducacion.js; 0 cuando el CV aún no fue evaluado.
const CASE_NIVEL_EDUCACION = `
  CASE p.datos_extraidos_cv->'afinidadDetalle'->'educacion'->>'nivelDetectado'
    WHEN 'DOCTORADO' THEN 6
    WHEN 'MAESTRIA' THEN 5
    WHEN 'LICENCIATURA' THEN 4
    WHEN 'TECNICO_SUPERIOR' THEN 3
    WHEN 'TECNICO_MEDIO' THEN 2
    WHEN 'BACHILLER' THEN 1
    ELSE 0
  END`;

const BASE_CTE = `
  WITH PostulantesEvaluados AS (
    SELECT
      p.id_postulacion,
      p.id_convocatoria,
      p.fecha_postulacion,
      p.porcentaje_afinidad AS score_afinidad,
      COALESCE((p.datos_extraidos_cv->>'aniosExperienciaEstimados')::numeric, 0) AS anios_experiencia,
      ${CASE_NIVEL_EDUCACION} AS nivel_educacion_orden,
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
    INNER JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
    LEFT JOIN CATALOGOS_ETAPA_POSTULACION cep ON cep.id_etapa = p.id_etapa
    WHERE p.id_convocatoria = $1
  )`;

// Arma el WHERE con parámetros posicionales a partir de los filtros activos (cada "?" se cambia por el marcador del valor).
function construirFiltros(idConvocatoria, { experiencia_min, etapa, ciudad }) {
  const condiciones = ["TRUE"];
  const valores = [idConvocatoria];
  const agregar = (sql, valor) => {
    valores.push(valor);
    condiciones.push(sql.split("?").join(`$${valores.length}`));
  };

  if (experiencia_min !== null && experiencia_min !== undefined) {
    agregar("anios_experiencia >= ?", experiencia_min);
  }
  if (etapa) {
    agregar("(UPPER(nombre_etapa) = UPPER(?) OR id_etapa::text = ?)", etapa);
  }
  if (ciudad) {
    agregar("LOWER(ciudad) = LOWER(?)", ciudad);
  }

  return { where: condiciones.join(" AND "), valores };
}

const aNumeroOnulo = (valor, decimales) =>
  valor === null || valor === undefined ? null : parseFloat(Number(valor).toFixed(decimales));

const rankingModel = {
  /**
   * Lista los postulantes de una convocatoria ordenados por porcentaje de afinidad (descendente),
   * con desempate configurable y filtros de visualización resueltos en la base de datos.
   * Los postulantes sin análisis de CV (score nulo) quedan al final.
   *
   * @param {string} idConvocatoria - UUID de la convocatoria.
   * @param {Object} filtros - Criterios de filtrado, ordenamiento y paginación.
   * @returns {Promise<{ postulantes: Array, totalRegistros: number }>}
   */
  async obtenerRankingPorConvocatoria(idConvocatoria, filtros = {}) {
    const {
      desempate = "experiencia",
      orden_desempate = "desc",
      experiencia_min = null,
      etapa = null,
      ciudad = null,
      pagina = 1,
      limite = 10,
    } = filtros;

    const offset = (pagina - 1) * limite;
    const clausulaDesempate = construirClausulaDesempate(desempate, orden_desempate);
    const { where, valores } = construirFiltros(idConvocatoria, { experiencia_min, etapa, ciudad });

    const countResult = await pool.query(
      `${BASE_CTE}
       SELECT COUNT(*) AS total FROM PostulantesEvaluados WHERE ${where};`,
      valores,
    );
    const totalRegistros = parseInt(countResult.rows[0]?.total || 0, 10);

    const { rows } = await pool.query(
      `${BASE_CTE}
       SELECT
         ROW_NUMBER() OVER (ORDER BY score_afinidad DESC NULLS LAST, ${clausulaDesempate}) AS posicion_ranking,
         *
       FROM PostulantesEvaluados
       WHERE ${where}
       ORDER BY posicion_ranking ASC
       LIMIT $${valores.length + 1} OFFSET $${valores.length + 2};`,
      [...valores, limite, offset],
    );

    const postulantes = rows.map((fila) => ({
      posicion_ranking: parseInt(fila.posicion_ranking, 10),
      id_postulacion: fila.id_postulacion,
      id_convocatoria: fila.id_convocatoria,
      fecha_postulacion: fila.fecha_postulacion,
      score_afinidad: aNumeroOnulo(fila.score_afinidad, 2),
      anios_experiencia: aNumeroOnulo(fila.anios_experiencia, 1),
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

    return { postulantes, totalRegistros };
  },
};

module.exports = rankingModel;
module.exports.construirClausulaDesempate = construirClausulaDesempate;
module.exports.construirFiltros = construirFiltros;
