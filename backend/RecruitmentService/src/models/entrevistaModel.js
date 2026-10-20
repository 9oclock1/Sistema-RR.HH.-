const pool = require("../../db/pool");
const { ESTADO_ENTREVISTA, ESTADOS_ACTIVOS } = require("../utils/entrevistas");

// Datos de la cita con su estado, el postulante y el último aviso enviado (o por enviar) al candidato.
const SELECT_ENTREVISTA = `
  SELECT en.id_entrevista, en.id_postulacion, en.fecha_hora_programada, en.duracion_minutos,
         en.fecha_hora_programada + make_interval(mins => en.duracion_minutos) AS fecha_hora_fin,
         en.modalidad, en.lugar_enlace, en.id_entrevistador_empleado, en.nombre_entrevistador,
         en.id_estado_entrevista, es.codigo AS codigo_estado, es.nombre AS nombre_estado, es.es_activa,
         en.notificacion_enviada, en.calificacion_entrevista, en.resultado_cualitativo,
         en.id_usuario_reclutador, en.nombre_usuario_reclutador, en.creado_en, en.actualizado_en,
         p.id_convocatoria, c.codigo_convocatoria, c.titulo_puesto,
         p.id_etapa, et.codigo AS codigo_etapa, et.nombre AS nombre_etapa,
         pos.id_postulante, pos.nombres, pos.apellidos, pos.correo_electronico, pos.telefono_contacto,
         ua.id_notificacion AS id_ultimo_aviso, ua.tipo_notificacion AS tipo_ultimo_aviso,
         ua.codigo_estado AS estado_ultimo_aviso, ua.ultimo_error AS error_ultimo_aviso
    FROM ENTREVISTAS en
    INNER JOIN CATALOGOS_ESTADO_ENTREVISTA es ON es.id_estado_entrevista = en.id_estado_entrevista
    INNER JOIN POSTULACIONES p ON p.id_postulacion = en.id_postulacion
    INNER JOIN CONVOCATORIAS c ON c.id_convocatoria = p.id_convocatoria
    INNER JOIN CATALOGOS_ETAPA_POSTULACION et ON et.id_etapa = p.id_etapa
    INNER JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
    LEFT JOIN LATERAL (
      SELECT n.id_notificacion, n.tipo_notificacion, ee.codigo AS codigo_estado, n.ultimo_error
        FROM NOTIFICACIONES_ENTREVISTA n
        INNER JOIN CATALOGOS_ESTADO_EVENTO ee ON ee.id_estado_evento = n.id_estado_evento
       WHERE n.id_entrevista = en.id_entrevista AND ee.codigo <> 'DESCARTADO'
       ORDER BY n.creado_en DESC
       LIMIT 1) ua ON TRUE`;

// Bloquea la postulación para que no cambie de etapa mientras se agenda la cita.
async function bloquearPostulacion(client, idPostulacion) {
  const { rows } = await client.query(
    `SELECT p.id_postulacion, p.id_etapa, p.esta_archivada, e.codigo AS codigo_etapa, e.nombre AS nombre_etapa,
            pos.nombres, pos.apellidos, pos.correo_electronico
       FROM POSTULACIONES p
       INNER JOIN CATALOGOS_ETAPA_POSTULACION e ON e.id_etapa = p.id_etapa
       INNER JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
      WHERE p.id_postulacion = $1
      FOR UPDATE OF p`,
    [idPostulacion],
  );
  return rows[0] || null;
}

// Bloquea la cita y su postulación para que dos reprogramaciones simultáneas no partan del mismo estado.
async function bloquearEntrevista(client, idEntrevista) {
  const { rows } = await client.query(
    `SELECT en.id_entrevista, en.id_postulacion, en.fecha_hora_programada, en.duracion_minutos, en.modalidad,
            en.lugar_enlace, en.id_entrevistador_empleado, en.nombre_entrevistador, en.id_estado_entrevista,
            es.nombre AS nombre_estado,
            p.id_etapa, p.esta_archivada, et.nombre AS nombre_etapa, pos.correo_electronico
       FROM ENTREVISTAS en
       INNER JOIN CATALOGOS_ESTADO_ENTREVISTA es ON es.id_estado_entrevista = en.id_estado_entrevista
       INNER JOIN POSTULACIONES p ON p.id_postulacion = en.id_postulacion
       INNER JOIN CATALOGOS_ETAPA_POSTULACION et ON et.id_etapa = p.id_etapa
       INNER JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
      WHERE en.id_entrevista = $1
      FOR UPDATE OF en, p`,
    [idEntrevista],
  );
  return rows[0] || null;
}

// Serializa las citas de un mismo evaluador: dos reclutadores no pueden ocupar a la vez el mismo hueco sin verse.
async function bloquearAgendaEvaluador(client, idEntrevistador) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext('agenda-entrevistas:' || $1))", [idEntrevistador]);
}

// Citas activas del evaluador que se cruzan con [inicio, inicio + duración).
async function buscarSolapamientos(client, { idEntrevistador, inicio, duracionMinutos, excluirId = null }) {
  const { rows } = await client.query(
    `SELECT en.id_entrevista, en.fecha_hora_programada, en.duracion_minutos,
            en.fecha_hora_programada + make_interval(mins => en.duracion_minutos) AS fecha_hora_fin,
            en.modalidad, pos.nombres, pos.apellidos
       FROM ENTREVISTAS en
       INNER JOIN POSTULACIONES p ON p.id_postulacion = en.id_postulacion
       INNER JOIN POSTULANTES pos ON pos.id_postulante = p.id_postulante
      WHERE en.id_entrevistador_empleado = $1
        AND en.id_estado_entrevista = ANY($5::smallint[])
        AND en.fecha_hora_programada < $2::timestamptz + make_interval(mins => $3::int)
        AND en.fecha_hora_programada + make_interval(mins => en.duracion_minutos) > $2::timestamptz
        AND ($4::uuid IS NULL OR en.id_entrevista <> $4::uuid)
      ORDER BY en.fecha_hora_programada`,
    [idEntrevistador, inicio, duracionMinutos, excluirId, ESTADOS_ACTIVOS],
  );
  return rows;
}

async function insertarEntrevista(client, { idPostulacion, cita, usuario }) {
  const { rows } = await client.query(
    `INSERT INTO ENTREVISTAS
            (id_postulacion, id_entrevistador_empleado, nombre_entrevistador, fecha_hora_programada, duracion_minutos,
             modalidad, lugar_enlace, id_usuario_reclutador, nombre_usuario_reclutador)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_entrevista`,
    [
      idPostulacion,
      cita.id_entrevistador_empleado,
      cita.nombre_entrevistador,
      cita.fecha_hora_programada,
      cita.duracion_minutos,
      cita.modalidad,
      cita.lugar_enlace,
      usuario.id,
      usuario.nombre,
    ],
  );
  return rows[0].id_entrevista;
}

// Cada cambio deja la cita pendiente de notificar al candidato.
async function actualizarEntrevista(client, idEntrevista, { cita, idEstado }) {
  await client.query(
    `UPDATE ENTREVISTAS
        SET id_entrevistador_empleado = $2,
            nombre_entrevistador = $3,
            fecha_hora_programada = $4,
            duracion_minutos = $5,
            modalidad = $6,
            lugar_enlace = $7,
            id_estado_entrevista = $8,
            notificacion_enviada = FALSE,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_entrevista = $1`,
    [
      idEntrevista,
      cita.id_entrevistador_empleado,
      cita.nombre_entrevistador,
      cita.fecha_hora_programada,
      cita.duracion_minutos,
      cita.modalidad,
      cita.lugar_enlace,
      idEstado,
    ],
  );
}

async function registrarHistorial(
  client,
  { idEntrevista, idEstadoAnterior = null, idEstado, fechaHoraAnterior = null, fechaHoraNueva, motivo = null, usuario },
) {
  const { rows } = await client.query(
    `INSERT INTO HISTORIALES_ENTREVISTA
            (id_entrevista, id_estado_anterior, id_estado, fecha_hora_anterior, fecha_hora_nueva, motivo,
             id_usuario, nombre_usuario)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_historial, id_entrevista, id_estado_anterior, id_estado, fecha_hora_anterior, fecha_hora_nueva,
               motivo, id_usuario, nombre_usuario, fecha_cambio`,
    [idEntrevista, idEstadoAnterior, idEstado, fechaHoraAnterior, fechaHoraNueva, motivo, usuario.id, usuario.nombre],
  );
  return rows[0];
}

// db: el cliente de la transacción en curso, para leer la cita recién escrita.
async function obtenerEntrevista(idEntrevista, db = pool) {
  const { rows } = await db.query(`${SELECT_ENTREVISTA} WHERE en.id_entrevista = $1`, [idEntrevista]);
  return rows[0] || null;
}

async function existePostulacion(idPostulacion) {
  const { rows } = await pool.query("SELECT 1 FROM POSTULACIONES WHERE id_postulacion = $1", [idPostulacion]);
  return rows.length > 0;
}

async function listarDePostulacion(idPostulacion) {
  const { rows } = await pool.query(
    `${SELECT_ENTREVISTA} WHERE en.id_postulacion = $1 ORDER BY en.fecha_hora_programada DESC`,
    [idPostulacion],
  );
  return rows;
}

// Agenda del reclutador: citas que se cruzan con el rango, opcionalmente de un solo evaluador.
async function listarAgenda({ desde, hasta, id_entrevistador_empleado, incluir_canceladas }) {
  const { rows } = await pool.query(
    `${SELECT_ENTREVISTA}
      WHERE en.fecha_hora_programada < $2
        AND en.fecha_hora_programada + make_interval(mins => en.duracion_minutos) > $1
        AND ($3::uuid IS NULL OR en.id_entrevistador_empleado = $3::uuid)
        AND ($4::boolean OR en.id_estado_entrevista <> $5)
      ORDER BY en.fecha_hora_programada`,
    [desde, hasta, id_entrevistador_empleado, incluir_canceladas, ESTADO_ENTREVISTA.CANCELADA],
  );
  return rows;
}

async function listarHistorial(idEntrevista) {
  const { rows } = await pool.query(
    `SELECT h.id_historial, h.id_estado_anterior, ea.codigo AS codigo_estado_anterior, ea.nombre AS nombre_estado_anterior,
            h.id_estado, e.codigo AS codigo_estado, e.nombre AS nombre_estado,
            h.fecha_hora_anterior, h.fecha_hora_nueva, h.motivo, h.id_usuario, h.nombre_usuario, h.fecha_cambio
       FROM HISTORIALES_ENTREVISTA h
       INNER JOIN CATALOGOS_ESTADO_ENTREVISTA e ON e.id_estado_entrevista = h.id_estado
       LEFT JOIN CATALOGOS_ESTADO_ENTREVISTA ea ON ea.id_estado_entrevista = h.id_estado_anterior
      WHERE h.id_entrevista = $1
      ORDER BY h.fecha_cambio DESC`,
    [idEntrevista],
  );
  return rows;
}

module.exports = {
  bloquearPostulacion,
  bloquearEntrevista,
  bloquearAgendaEvaluador,
  buscarSolapamientos,
  insertarEntrevista,
  actualizarEntrevista,
  registrarHistorial,
  obtenerEntrevista,
  existePostulacion,
  listarDePostulacion,
  listarAgenda,
  listarHistorial,
};
