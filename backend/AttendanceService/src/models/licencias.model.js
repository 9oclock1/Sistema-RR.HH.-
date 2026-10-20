const pool = require("../config/db");

const COLUMNAS_TIPO = `id_tipo_licencia, codigo, nombre, es_con_goce_haberes, dias_maximos_continuos, requiere_adjunto`;

const SOLICITUD_CON_CATALOGOS = `
  SELECT s.id_solicitud, s.id_empleado, s.fecha_inicio, s.fecha_fin, s.dias_solicitados,
         s.es_con_goce_haberes, s.excede_limite_dias, s.motivo, s.creado_en,
         s.id_empleado_resolutor, s.resuelto_en, s.motivo_resolucion,
         t.id_tipo_licencia, t.codigo AS tipo_codigo, t.nombre AS tipo_nombre,
         e.codigo AS estado_codigo, e.nombre AS estado_nombre,
         COALESCE((SELECT json_agg(json_build_object(
                     'id_adjunto', a.id_adjunto, 'nombre_original', a.nombre_original,
                     'formato_mimetype', a.formato_mimetype, 'tamano_bytes', a.tamano_bytes)
                   ORDER BY a.subido_en)
                   FROM adjuntos_solicitud_licencia a WHERE a.id_solicitud = s.id_solicitud), '[]') AS adjuntos
  FROM solicitudes_licencia s
  JOIN catalogos_tipo_licencia t USING (id_tipo_licencia)
  JOIN catalogos_estado_solicitud e USING (id_estado_solicitud)`;

async function listarTipos() {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_TIPO} FROM catalogos_tipo_licencia WHERE esta_activo ORDER BY id_tipo_licencia`
  );
  return rows;
}

async function obtenerTipo(id) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_TIPO} FROM catalogos_tipo_licencia WHERE id_tipo_licencia = $1 AND esta_activo`,
    [id]
  );
  return rows[0];
}

// Solicitud y adjuntos se guardan juntos: o quedan ambos o ninguno.
async function crear(solicitud, adjuntos) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rows } = await cliente.query(
      `INSERT INTO solicitudes_licencia
         (id_empleado, id_tipo_licencia, id_estado_solicitud, fecha_inicio, fecha_fin, es_con_goce_haberes, excede_limite_dias, motivo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id_solicitud`,
      [
        solicitud.idEmpleado,
        solicitud.idTipo,
        solicitud.idEstado,
        solicitud.fechaInicio,
        solicitud.fechaFin,
        solicitud.esConGoceHaberes,
        solicitud.excedeLimiteDias,
        solicitud.motivo,
      ]
    );
    const idSolicitud = rows[0].id_solicitud;
    for (const a of adjuntos) {
      await cliente.query(
        `INSERT INTO adjuntos_solicitud_licencia (id_solicitud, nombre_original, archivo_url, formato_mimetype, tamano_bytes)
         VALUES ($1, $2, $3, $4, $5)`,
        [idSolicitud, a.nombreOriginal, a.clave, a.mimetype, a.tamano]
      );
    }
    await cliente.query("COMMIT");
    return idSolicitud;
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function obtener(idSolicitud) {
  const { rows } = await pool.query(`${SOLICITUD_CON_CATALOGOS} WHERE s.id_solicitud = $1`, [idSolicitud]);
  return rows[0];
}

async function listarPorEmpleado(idEmpleado) {
  const { rows } = await pool.query(
    `${SOLICITUD_CON_CATALOGOS} WHERE s.id_empleado = $1 ORDER BY s.fecha_inicio DESC, s.creado_en DESC`,
    [idEmpleado]
  );
  return rows;
}

async function obtenerAdjunto(idSolicitud, idAdjunto) {
  const { rows } = await pool.query(
    `SELECT a.nombre_original, a.archivo_url, a.formato_mimetype, s.id_empleado
     FROM adjuntos_solicitud_licencia a JOIN solicitudes_licencia s USING (id_solicitud)
     WHERE a.id_solicitud = $1 AND a.id_adjunto = $2`,
    [idSolicitud, idAdjunto]
  );
  return rows[0];
}

// KAN-54: solo resuelve una solicitud que sigue pendiente, así dos supervisores no se pisan.
// KAN-53: `alResolver` corre en la misma transacción (p. ej. para registrar el evento de indisponibilidad), de modo
// que la aprobación y su sincronización con otros módulos quedan juntas o no quedan.
async function resolver({ idSolicitud, idEstado, idResolutor, motivo }, alResolver) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");
    const { rowCount } = await cliente.query(
      `UPDATE solicitudes_licencia
          SET id_estado_solicitud = $2, id_empleado_resolutor = $3, resuelto_en = CURRENT_TIMESTAMP,
              motivo_resolucion = $4, actualizado_en = CURRENT_TIMESTAMP
        WHERE id_solicitud = $1 AND id_estado_solicitud = 1`,
      [idSolicitud, idEstado, idResolutor, motivo]
    );
    if (rowCount === 1 && alResolver) await alResolver(cliente);
    await cliente.query("COMMIT");
    return rowCount === 1;
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

async function marcarResolucionNotificada(idSolicitud) {
  await pool.query(
    `UPDATE solicitudes_licencia SET resolucion_notificada_en = CURRENT_TIMESTAMP WHERE id_solicitud = $1`,
    [idSolicitud]
  );
}

// Resoluciones sin aviso confirmado; se espera unos segundos para no competir con el envío en línea.
async function listarResolucionesSinNotificar(limite) {
  const { rows } = await pool.query(
    `${SOLICITUD_CON_CATALOGOS}
     WHERE s.resuelto_en IS NOT NULL AND s.resolucion_notificada_en IS NULL
       AND s.resuelto_en < CURRENT_TIMESTAMP - INTERVAL '30 seconds'
     ORDER BY s.resuelto_en LIMIT $1`,
    [limite]
  );
  return rows;
}

module.exports = {
  listarTipos,
  obtenerTipo,
  crear,
  obtener,
  listarPorEmpleado,
  obtenerAdjunto,
  resolver,
  marcarResolucionNotificada,
  listarResolucionesSinNotificar,
};
