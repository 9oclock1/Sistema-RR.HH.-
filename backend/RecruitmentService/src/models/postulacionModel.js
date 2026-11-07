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

  // pipeline de extraccion
  async guardarDatosExtraidosCv(idPostulacion, datosJson) {
    const query = `
      UPDATE POSTULACIONES
      SET 
        datos_extraidos_cv = $2,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id_postulacion = $1
      RETURNING id_postulacion, datos_extraidos_cv;
    `;
    const { rows } = await pool.query(query, [
      idPostulacion,
      JSON.stringify(datosJson),
    ]);
    return rows[0] || null;
  },

  // datos corregidos manualmente
  async actualizarDatosCvManual(idPostulacion, payloadManual) {
    const datosActualizados = {
      educacion: payloadManual.educacion || [],
      experienciaLaboral: payloadManual.experienciaLaboral || [],
      aniosExperienciaEstimados: payloadManual.aniosExperienciaEstimados || 0,
      destrezasTecnicas: payloadManual.destrezasTecnicas || [],
      esVerificado: true,
      modificadoPor: payloadManual.modificadoPor,
      fechaVerificacion: new Date().toISOString(),
      estadoExtraccion: "EXITOSA",
    };

    const query = `
      UPDATE POSTULACIONES
      SET 
        datos_extraidos_cv = $2,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id_postulacion = $1
      RETURNING id_postulacion, datos_extraidos_cv;
    `;
    const { rows } = await pool.query(query, [
      idPostulacion,
      JSON.stringify(datosActualizados),
    ]);
    return rows[0] || null;
  },

  async obtenerDatosCvPorPostulacionId(idPostulacion) {
    const query = `
    SELECT 
      id_postulacion AS "idPostulacion",
      id_convocatoria AS "idConvocatoria",
      id_postulante AS "idPostulante",
      cv_archivo_url AS "cvArchivoUrl",
      cv_formato_mimetype AS "cvFormatoMimetype",
      datos_extraidos_cv AS "datosExtraidosCv"
    FROM POSTULACIONES
    WHERE id_postulacion = $1;
  `;
    const { rows } = await pool.query(query, [idPostulacion]);
    return rows[0] || null;
  },

  // Actualizar afinidad, ranking y desglose dentro de datos_extraidos_cv
  async guardarAfinidadPostulacion(
    idPostulacion,
    { porcentajeAfinidad, afinidadDetalle },
  ) {
    const query = `
      UPDATE POSTULACIONES
      SET 
        porcentaje_afinidad = $2,
        datos_extraidos_cv = CASE 
          WHEN datos_extraidos_cv IS NOT NULL THEN 
            jsonb_set(datos_extraidos_cv, '{afinidadDetalle}', $3::jsonb, true)
          ELSE 
            jsonb_build_object('afinidadDetalle', $3::jsonb)
        END,
        actualizado_en = CURRENT_TIMESTAMP
      WHERE id_postulacion = $1
      RETURNING id_postulacion, id_convocatoria, porcentaje_afinidad, datos_extraidos_cv;
    `;
    const { rows } = await pool.query(query, [
      idPostulacion,
      porcentajeAfinidad,
      JSON.stringify(afinidadDetalle),
    ]);
    return rows[0] || null;
  },

  // Recalcular posiciones de ranking de todos los postulantes de una convocatoria
  async actualizarRankingsPorConvocatoria(idConvocatoria) {
    const query = `
      WITH ranking_calculado AS (
        SELECT 
          id_postulacion,
          ROW_NUMBER() OVER (
            PARTITION BY id_convocatoria 
            ORDER BY 
              porcentaje_afinidad DESC NULLS LAST, 
              fecha_postulacion ASC
          ) as nuevo_ranking
        FROM POSTULACIONES
        WHERE id_convocatoria = $1
      )
      UPDATE POSTULACIONES p
      SET 
        posicion_ranking = r.nuevo_ranking,
        actualizado_en = CURRENT_TIMESTAMP
      FROM ranking_calculado r
      WHERE p.id_postulacion = r.id_postulacion;
    `;
    await pool.query(query, [idConvocatoria]);
  },

  // Obtener todas las postulaciones asociadas a una convocatoria para recálculo masivo
  async listarPorConvocatoriaParaRecalculo(idConvocatoria) {
    const query = `
      SELECT 
        p.id_postulacion,
        p.id_convocatoria,
        p.datos_extraidos_cv,
        p.porcentaje_afinidad
      FROM POSTULACIONES p
      WHERE p.id_convocatoria = $1;
    `;
    const { rows } = await pool.query(query, [idConvocatoria]);
    return rows;
  },
};

module.exports = { PostulacionModel };
