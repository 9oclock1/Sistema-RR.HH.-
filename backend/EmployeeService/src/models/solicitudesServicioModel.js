const { randomUUID } = require('node:crypto');

const SELECT_SOLICITUD = `
  SELECT ss.id_solicitud_servicio,
         ss.id_mensaje,
         ss.id_curso,
         cu.codigo AS curso_codigo,
         cu.nombre AS curso,
         cu.tipo_capacitacion,
         cu.horas_academicas,
         ss.id_empleado_solicitante,
         concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS solicitante,
         ss.descripcion_requerimiento,
         ss.cantidad_participantes,
         ss.fecha_requerida,
         ss.monto_estimado,
         ss.estado,
         ss.numero_orden_servicio,
         ss.proveedor_nombre,
         ss.proveedor_nit,
         ss.monto_adjudicado,
         ss.intentos_envio,
         ss.proximo_intento_en,
         ss.ultimo_error,
         ss.enviada_en,
         ss.registrado_en,
         ss.actualizado_en
    FROM solicitudes_servicio_capacitacion ss
    JOIN cursos_capacitacion cu ON cu.id_curso = ss.id_curso
    JOIN empleados e            ON e.id_empleado = ss.id_empleado_solicitante
`;

const listar = async (db, { id_curso, estado }) => {
  const condiciones = [];
  const valores = [];
  if (id_curso) {
    valores.push(id_curso);
    condiciones.push(`ss.id_curso = $${valores.length}`);
  }
  if (estado) {
    valores.push(estado);
    condiciones.push(`ss.estado = $${valores.length}`);
  }

  const filtro = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await db.query(`${SELECT_SOLICITUD} ${filtro} ORDER BY ss.registrado_en DESC`, valores);
  return rows;
};

const obtenerPorId = async (db, idSolicitud) => {
  const { rows } = await db.query(`${SELECT_SOLICITUD} WHERE ss.id_solicitud_servicio = $1`, [idSolicitud]);
  return rows[0] || null;
};

const bloquearPorId = async (db, idSolicitud) => {
  const { rows } = await db.query(
    'SELECT id_solicitud_servicio, estado FROM solicitudes_servicio_capacitacion WHERE id_solicitud_servicio = $1 FOR UPDATE',
    [idSolicitud]
  );
  return rows[0] || null;
};

const listarHistorial = async (db, idSolicitud) => {
  const { rows } = await db.query(
    `SELECT id_evento, estado_anterior, estado_nuevo, origen, id_mensaje_externo, detalle, carga_mensaje, registrado_en
       FROM historial_solicitud_servicio
      WHERE id_solicitud_servicio = $1
      ORDER BY registrado_en ASC`,
    [idSolicitud]
  );
  return rows;
};

const listarPendientesDeEnvio = async (db, limite) => {
  const { rows } = await db.query(
    `SELECT id_solicitud_servicio
       FROM solicitudes_servicio_capacitacion
      WHERE estado = 'PENDIENTE_ENVIO'
        AND (proximo_intento_en IS NULL OR proximo_intento_en <= CURRENT_TIMESTAMP)
      ORDER BY proximo_intento_en NULLS FIRST
      LIMIT $1`,
    [limite]
  );
  return rows.map((fila) => fila.id_solicitud_servicio);
};

const listarParaRespuestaSimulada = async (db, minutosPorEtapa, limite) => {
  const { rows } = await db.query(
    `SELECT id_solicitud_servicio, id_mensaje, estado, cantidad_participantes, monto_estimado
       FROM solicitudes_servicio_capacitacion
      WHERE estado IN ('ENVIADA', 'EN_PROCESO')
        AND actualizado_en <= CURRENT_TIMESTAMP - make_interval(mins => $1::int)
      ORDER BY actualizado_en
      LIMIT $2`,
    [minutosPorEtapa, limite]
  );
  return rows;
};

const existeMensajeExterno = async (db, idMensajeExterno) => {
  const { rows } = await db.query(
    'SELECT id_solicitud_servicio FROM historial_solicitud_servicio WHERE id_mensaje_externo = $1',
    [idMensajeExterno]
  );
  return rows[0]?.id_solicitud_servicio ?? null;
};

const existeNumeroOrden = async (db, numeroOrden, idSolicitudExcluida) => {
  const { rows } = await db.query(
    `SELECT 1 FROM solicitudes_servicio_capacitacion
      WHERE numero_orden_servicio = $1 AND id_solicitud_servicio <> $2
      LIMIT 1`,
    [numeroOrden, idSolicitudExcluida]
  );
  return rows.length > 0;
};

const insertar = async (db, solicitud, minutosAntesDeReintentar) => {
  const { rows } = await db.query(
    `INSERT INTO solicitudes_servicio_capacitacion (
       id_solicitud_servicio, id_mensaje, id_curso, id_empleado_solicitante, descripcion_requerimiento,
       cantidad_participantes, fecha_requerida, monto_estimado, proximo_intento_en
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP + make_interval(mins => $9::int))
     RETURNING id_solicitud_servicio`,
    [
      randomUUID(),
      randomUUID(),
      solicitud.id_curso,
      solicitud.id_empleado_solicitante,
      solicitud.descripcion_requerimiento,
      solicitud.cantidad_participantes,
      solicitud.fecha_requerida,
      solicitud.monto_estimado,
      minutosAntesDeReintentar,
    ]
  );
  return rows[0].id_solicitud_servicio;
};

const registrarEvento = async (db, evento) => {
  await db.query(
    `INSERT INTO historial_solicitud_servicio (
       id_evento, id_solicitud_servicio, estado_anterior, estado_nuevo, origen, id_mensaje_externo, detalle, carga_mensaje
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      randomUUID(),
      evento.id_solicitud_servicio,
      evento.estado_anterior ?? null,
      evento.estado_nuevo,
      evento.origen,
      evento.id_mensaje_externo ?? null,
      evento.detalle ?? null,
      evento.carga_mensaje ? JSON.stringify(evento.carga_mensaje) : null,
    ]
  );
};

const marcarEnviada = async (db, idSolicitud) => {
  await db.query(
    `UPDATE solicitudes_servicio_capacitacion
        SET estado = 'ENVIADA',
            intentos_envio = intentos_envio + 1,
            enviada_en = CURRENT_TIMESTAMP,
            proximo_intento_en = NULL,
            ultimo_error = NULL,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_solicitud_servicio = $1`,
    [idSolicitud]
  );
};

const registrarFalloEnvio = async (db, idSolicitud, error, minutosEspera) => {
  await db.query(
    `UPDATE solicitudes_servicio_capacitacion
        SET intentos_envio = intentos_envio + 1,
            ultimo_error = $2,
            proximo_intento_en = CURRENT_TIMESTAMP + make_interval(mins => $3::int),
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_solicitud_servicio = $1`,
    [idSolicitud, error, minutosEspera]
  );
};

const aplicarRespuestaCompras = async (db, idSolicitud, respuesta) => {
  await db.query(
    `UPDATE solicitudes_servicio_capacitacion
        SET estado = $2,
            numero_orden_servicio = COALESCE($3, numero_orden_servicio),
            proveedor_nombre = COALESCE($4, proveedor_nombre),
            proveedor_nit = COALESCE($5, proveedor_nit),
            monto_adjudicado = COALESCE($6, monto_adjudicado),
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_solicitud_servicio = $1`,
    [
      idSolicitud,
      respuesta.estado,
      respuesta.numero_orden_servicio,
      respuesta.proveedor_nombre,
      respuesta.proveedor_nit,
      respuesta.monto_adjudicado,
    ]
  );
};

module.exports = {
  listar,
  obtenerPorId,
  bloquearPorId,
  listarHistorial,
  listarPendientesDeEnvio,
  listarParaRespuestaSimulada,
  existeMensajeExterno,
  existeNumeroOrden,
  insertar,
  registrarEvento,
  marcarEnviada,
  registrarFalloEnvio,
  aplicarRespuestaCompras,
};
