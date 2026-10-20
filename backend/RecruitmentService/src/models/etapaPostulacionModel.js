const pool = require("../../db/pool");
const { ETAPA } = require("../utils/etapas");

// Bloquea la postulación para que dos cambios simultáneos no partan de la misma etapa.
async function bloquearPostulacion(client, idPostulacion) {
  const { rows } = await client.query(
    `SELECT p.id_postulacion, p.id_convocatoria, p.id_postulante, p.id_etapa, p.esta_archivada,
            e.codigo AS codigo_etapa, e.nombre AS nombre_etapa, e.es_final
       FROM POSTULACIONES p
       INNER JOIN CATALOGOS_ETAPA_POSTULACION e ON e.id_etapa = p.id_etapa
      WHERE p.id_postulacion = $1
      FOR UPDATE OF p`,
    [idPostulacion],
  );
  return rows[0] || null;
}

async function obtenerEtapa(client, { id_etapa, codigo_etapa }) {
  const { rows } = await client.query(
    `SELECT id_etapa, codigo, nombre, orden_flujo, es_final, esta_activa
       FROM CATALOGOS_ETAPA_POSTULACION
      WHERE ${id_etapa !== null ? "id_etapa = $1" : "codigo = $1"}`,
    [id_etapa !== null ? id_etapa : codigo_etapa],
  );
  return rows[0] || null;
}

async function obtenerTransicion(client, idEtapaOrigen, idEtapaDestino) {
  const { rows } = await client.query(
    `SELECT id_etapa_origen, id_etapa_destino, solicita_motivo, requiere_cargo
       FROM TRANSICIONES_ETAPA_POSTULACION
      WHERE id_etapa_origen = $1 AND id_etapa_destino = $2`,
    [idEtapaOrigen, idEtapaDestino],
  );
  return rows[0] || null;
}

async function listarDestinosPermitidos(client, idEtapaOrigen) {
  const { rows } = await client.query(
    `SELECT e.id_etapa, e.codigo, e.nombre
       FROM TRANSICIONES_ETAPA_POSTULACION t
       INNER JOIN CATALOGOS_ETAPA_POSTULACION e ON e.id_etapa = t.id_etapa_destino
      WHERE t.id_etapa_origen = $1 AND e.esta_activa
      ORDER BY e.orden_flujo`,
    [idEtapaOrigen],
  );
  return rows;
}

async function obtenerCargoOperativo(client, idCargoOperativo) {
  const { rows } = await client.query(
    `SELECT c.id_cargo_operativo, c.codigo, c.nombre, d.id_destino, d.codigo AS codigo_destino, d.nombre_modulo
       FROM CATALOGOS_CARGO_OPERATIVO c
       INNER JOIN CATALOGOS_DESTINO_INTEGRACION d ON d.id_destino = c.id_destino
      WHERE c.id_cargo_operativo = $1`,
    [idCargoOperativo],
  );
  return rows[0] || null;
}

// Bloquea la convocatoria para que dos contrataciones simultáneas no superen las vacantes.
async function contarVacantes(client, idConvocatoria) {
  const { rows } = await client.query(
    `SELECT c.cantidad_vacantes AS cantidad,
            (SELECT COUNT(*)::int FROM POSTULACIONES p
              WHERE p.id_convocatoria = c.id_convocatoria AND p.id_etapa = $2) AS contratados
       FROM CONVOCATORIAS c
      WHERE c.id_convocatoria = $1
      FOR UPDATE OF c`,
    [idConvocatoria, ETAPA.CONTRATADO],
  );
  return rows[0] || null;
}

// Al contratar se guarda el cargo y la fecha; al rechazar se archiva la postulación.
async function actualizarEtapa(
  client,
  { idPostulacion, idEtapa, idCargoOperativo = null },
) {
  const { rows } = await client.query(
    `UPDATE POSTULACIONES
        SET id_etapa = $2::smallint,
            id_cargo_operativo = CASE WHEN $2::smallint = $4::smallint THEN $3::smallint ELSE id_cargo_operativo END,
            contratado_en = CASE WHEN $2::smallint = $4::smallint THEN CURRENT_TIMESTAMP ELSE contratado_en END,
            esta_archivada = esta_archivada OR $2::smallint = $5::smallint,
            archivada_en = CASE WHEN $2::smallint = $5::smallint THEN CURRENT_TIMESTAMP ELSE archivada_en END,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_postulacion = $1
      RETURNING id_postulacion, id_convocatoria, id_postulante, id_etapa, id_cargo_operativo,
                contratado_en, esta_archivada, archivada_en, actualizado_en`,
    [
      idPostulacion,
      idEtapa,
      idCargoOperativo,
      ETAPA.CONTRATADO,
      ETAPA.RECHAZADO,
    ],
  );
  return rows[0];
}

async function registrarHistorial(
  client,
  { idPostulacion, idEtapaAnterior, idEtapa, usuario, motivo },
) {
  const { rows } = await client.query(
    `INSERT INTO HISTORIALES_ETAPA_POSTULACION
            (id_postulacion, id_etapa_anterior, id_etapa, id_usuario_evaluador, nombre_usuario_evaluador, comentarios_etapa)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_historial, id_postulacion, id_etapa_anterior, id_etapa, id_usuario_evaluador,
               nombre_usuario_evaluador, comentarios_etapa, fecha_cambio`,
    [
      idPostulacion,
      idEtapaAnterior,
      idEtapa,
      usuario.id,
      usuario.nombre,
      motivo,
    ],
  );
  return rows[0];
}

async function existePostulacion(idPostulacion) {
  const { rows } = await pool.query(
    "SELECT 1 FROM POSTULACIONES WHERE id_postulacion = $1",
    [idPostulacion],
  );
  return rows.length > 0;
}

// Trazabilidad: del cambio más reciente al más antiguo.
async function listarHistorial(idPostulacion) {
  const { rows } = await pool.query(
    `SELECT h.id_historial,
            h.id_etapa_anterior, ea.codigo AS codigo_etapa_anterior, ea.nombre AS nombre_etapa_anterior,
            h.id_etapa, e.codigo AS codigo_etapa, e.nombre AS nombre_etapa,
            h.id_usuario_evaluador, h.nombre_usuario_evaluador,
            h.comentarios_etapa AS motivo, h.fecha_cambio
       FROM HISTORIALES_ETAPA_POSTULACION h
       INNER JOIN CATALOGOS_ETAPA_POSTULACION e ON e.id_etapa = h.id_etapa
       LEFT JOIN CATALOGOS_ETAPA_POSTULACION ea ON ea.id_etapa = h.id_etapa_anterior
      WHERE h.id_postulacion = $1
      ORDER BY h.fecha_cambio DESC`,
    [idPostulacion],
  );
  return rows;
}

// Catálogo para el pipeline: etapas activas, cambios permitidos y cargos operativos.
async function obtenerCatalogo() {
  const [etapas, transiciones, cargos] = await Promise.all([
    pool.query(
      `SELECT id_etapa, codigo, nombre, orden_flujo, es_final
         FROM CATALOGOS_ETAPA_POSTULACION
        WHERE esta_activa
        ORDER BY orden_flujo`,
    ),
    pool.query(
      `SELECT t.id_etapa_origen, t.id_etapa_destino, t.solicita_motivo, t.requiere_cargo
         FROM TRANSICIONES_ETAPA_POSTULACION t
         INNER JOIN CATALOGOS_ETAPA_POSTULACION o ON o.id_etapa = t.id_etapa_origen
         INNER JOIN CATALOGOS_ETAPA_POSTULACION d ON d.id_etapa = t.id_etapa_destino
        WHERE o.esta_activa AND d.esta_activa
        ORDER BY o.orden_flujo, d.orden_flujo`,
    ),
    pool.query(
      `SELECT c.id_cargo_operativo, c.codigo, c.nombre, d.codigo AS codigo_destino, d.nombre_modulo
         FROM CATALOGOS_CARGO_OPERATIVO c
         INNER JOIN CATALOGOS_DESTINO_INTEGRACION d ON d.id_destino = c.id_destino
        ORDER BY c.id_cargo_operativo`,
    ),
  ]);
  return {
    etapas: etapas.rows,
    transiciones: transiciones.rows,
    cargos_operativos: cargos.rows,
  };
}

module.exports = {
  bloquearPostulacion,
  obtenerEtapa,
  obtenerTransicion,
  listarDestinosPermitidos,
  obtenerCargoOperativo,
  contarVacantes,
  actualizarEtapa,
  registrarHistorial,
  existePostulacion,
  listarHistorial,
  obtenerCatalogo,
};
