const { randomUUID } = require('node:crypto');

const COLUMNAS = `id_memorandum, id_empleado_receptor, id_tipo_memo, id_empleado_emisor,
               codigo_cite, asunto, contenido_descripcion, fecha_emision,
               gestion, numero_correlativo, naturaleza_falta, gravedad_falta,
               estado_sancion, evidencia_adjunto_url, documento_pdf_url`;

// Amonestaciones del empleado en los últimos `meses`; las anuladas no cuentan.
// Los reconocimientos (RF-38) viven en la misma tabla sin datos de falta y tampoco cuentan.
const contarRecientes = async (db, idEmpleadoReceptor, meses) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM memorandums
      WHERE id_empleado_receptor = $1
        AND estado_sancion <> 'ANULADO'
        AND naturaleza_falta IS NOT NULL
        AND fecha_emision >= CURRENT_DATE - make_interval(months => $2::int)`,
    [idEmpleadoReceptor, meses]
  );
  return rows[0].total;
};

// Debe ejecutarse en la misma transacción que inserta el memorándum: el bloqueo de fila
// serializa las emisiones concurrentes y un ROLLBACK devuelve el número.
const siguienteCorrelativo = async (db, gestion) => {
  const { rows } = await db.query(
    `INSERT INTO correlativos_memorandum (gestion, ultimo_numero) VALUES ($1, 1)
     ON CONFLICT (gestion) DO UPDATE SET ultimo_numero = correlativos_memorandum.ultimo_numero + 1
     RETURNING ultimo_numero`,
    [gestion]
  );
  return rows[0].ultimo_numero;
};

// La amonestación queda EMITIDA desde el INSERT: el CITE y el correlativo ya están asignados y el PDF se genera
// en la misma transacción, así que un ROLLBACK la descarta por completo.
const insertarAmonestacion = async (db, memorandum) => {
  const { rows } = await db.query(
    `INSERT INTO memorandums (
        id_memorandum, id_empleado_receptor, id_tipo_memo, id_empleado_emisor,
        codigo_cite, asunto, contenido_descripcion, fecha_emision,
        gestion, numero_correlativo, naturaleza_falta, gravedad_falta,
        estado_sancion, evidencia_adjunto_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'EMITIDO', $13)
     RETURNING ${COLUMNAS}`,
    [
      randomUUID(),
      memorandum.id_empleado_receptor,
      memorandum.id_tipo_memo,
      memorandum.id_empleado_emisor,
      memorandum.codigo_cite,
      memorandum.asunto,
      memorandum.contenido_descripcion,
      memorandum.fecha_emision,
      memorandum.gestion,
      memorandum.numero_correlativo,
      memorandum.naturaleza_falta,
      memorandum.gravedad_falta,
      memorandum.evidencia_adjunto_url,
    ]
  );
  return rows[0];
};

const obtenerTipo = async (db, idTipoMemo) => {
  const { rows } = await db.query(
    'SELECT id_tipo_memo, clasificacion, nombre FROM tipos_memorandum WHERE id_tipo_memo = $1',
    [idTipoMemo]
  );
  return rows[0] || null;
};

// Catálogo de tipos para los formularios; `clasificacion` es opcional.
const listarTipos = async (db, clasificacion) => {
  const { rows } = await db.query(
    `SELECT id_tipo_memo, clasificacion, nombre, descripcion
       FROM tipos_memorandum
      WHERE ($1::text IS NULL OR upper(trim(clasificacion)) = $1)
      ORDER BY id_tipo_memo`,
    [clasificacion]
  );
  return rows;
};

// RF-38: un reconocimiento no lleva datos de falta ni evidencia y queda emitido al registrarse.
const insertarReconocimiento = async (db, reconocimiento) => {
  const { rows } = await db.query(
    `INSERT INTO memorandums (
        id_memorandum, id_empleado_receptor, id_tipo_memo, id_empleado_emisor,
        codigo_cite, asunto, contenido_descripcion, fecha_emision,
        gestion, numero_correlativo, naturaleza_falta, gravedad_falta,
        estado_sancion
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NULL, NULL, 'EMITIDO')
     RETURNING ${COLUMNAS}`,
    [
      randomUUID(),
      reconocimiento.id_empleado_receptor,
      reconocimiento.id_tipo_memo,
      reconocimiento.id_empleado_emisor,
      reconocimiento.codigo_cite,
      reconocimiento.asunto,
      reconocimiento.contenido_descripcion,
      reconocimiento.fecha_emision,
      reconocimiento.gestion,
      reconocimiento.numero_correlativo,
    ]
  );
  return rows[0];
};

// Datos del memorándum, del receptor y del emisor que van impresos en el PDF oficial.
const obtenerParaDocumento = async (db, idMemorandum) => {
  const { rows } = await db.query(
    `SELECT m.codigo_cite,
            m.asunto,
            m.contenido_descripcion,
            m.fecha_emision,
            m.naturaleza_falta,
            m.gravedad_falta,
            m.evidencia_adjunto_url,
            t.nombre AS tipo_nombre,
            concat_ws(' ', r.nombres, r.primer_apellido, r.segundo_apellido) AS receptor_nombre,
            concat_ws('-', r.numero_documento, r.complemento_documento) AS receptor_documento,
            cr.nombre AS receptor_cargo,
            sr.nombre AS receptor_sucursal,
            sr.ciudad AS receptor_ciudad,
            concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS emisor_nombre,
            ce.nombre AS emisor_cargo
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
       JOIN empleados r        ON r.id_empleado = m.id_empleado_receptor
       JOIN cargos cr          ON cr.id_cargo = r.id_cargo_actual
       JOIN sucursales sr      ON sr.id_sucursal = r.id_sucursal_actual
       JOIN empleados e        ON e.id_empleado = m.id_empleado_emisor
       JOIN cargos ce          ON ce.id_cargo = e.id_cargo_actual
      WHERE m.id_memorandum = $1`,
    [idMemorandum]
  );
  return rows[0] || null;
};

const listarPorEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT m.id_memorandum,
            m.codigo_cite,
            m.asunto,
            m.fecha_emision,
            m.gravedad_falta,
            m.documento_pdf_url,
            m.estado_acuse,
            m.fecha_hora_acuse,
            t.nombre AS tipo_nombre,
            (upper(trim(t.clasificacion)) = 'RECONOCIMIENTO') AS es_reconocimiento
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
      WHERE m.id_empleado_receptor = $1
        AND m.estado_sancion <> 'ANULADO'
      ORDER BY m.fecha_emision DESC, m.numero_correlativo DESC`,
    [idEmpleado]
  );
  return rows;
};

const guardarRutaPdf = async (db, idMemorandum, rutaPdf) => {
  const { rows } = await db.query(
    `UPDATE memorandums SET documento_pdf_url = $1 WHERE id_memorandum = $2 RETURNING ${COLUMNAS}`,
    [rutaPdf, idMemorandum]
  );
  return rows[0];
};

// Ruta del PDF ya generado; null si el memorándum no existe.
const obtenerDocumento = async (db, idMemorandum) => {
  const { rows } = await db.query(
    'SELECT codigo_cite, documento_pdf_url FROM memorandums WHERE id_memorandum = $1',
    [idMemorandum]
  );
  return rows[0] || null;
};

// ---------------------------------------------------------------------------------------------
// RF-39: notificación y acuse de recibo.
// ---------------------------------------------------------------------------------------------

const COLUMNAS_ACUSE = `m.id_memorandum, m.id_empleado_receptor, m.id_empleado_emisor, m.codigo_cite, m.asunto,
               m.fecha_emision, m.documento_pdf_url, m.fue_notificado, m.fecha_hora_notificacion,
               m.fecha_limite_acuse, m.fecha_hora_apertura, m.estado_acuse, m.acuse_recibo_firmado,
               m.fecha_hora_acuse, m.ip_acuse, m.id_usuario_acuse, m.comentario_descargo, m.fecha_hora_alerta_rrhh,
               t.nombre AS tipo_nombre,
               (upper(trim(t.clasificacion)) = 'RECONOCIMIENTO') AS es_reconocimiento`;

// Datos que necesitan los avisos: CITE, clase y nombres de receptor y emisor.
const obtenerParaAviso = async (db, idMemorandum) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ACUSE},
            concat_ws(' ', r.nombres, r.primer_apellido, r.segundo_apellido) AS receptor_nombre
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
       JOIN empleados r        ON r.id_empleado = m.id_empleado_receptor
      WHERE m.id_memorandum = $1`,
    [idMemorandum]
  );
  return rows[0] || null;
};

// Bloquea un emitido aún sin aviso; SKIP LOCKED evita que la emisión y el job lo avisen a la vez.
const bloquearSinNotificar = async (db, idMemorandum) => {
  const { rows } = await db.query(
    `SELECT m.id_memorandum, m.id_empleado_receptor, m.id_empleado_emisor, m.codigo_cite, m.asunto,
            t.nombre AS tipo_nombre,
            (upper(trim(t.clasificacion)) = 'RECONOCIMIENTO') AS es_reconocimiento
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
      WHERE m.id_memorandum = $1 AND m.estado_sancion = 'EMITIDO' AND m.fue_notificado = FALSE
        FOR UPDATE OF m SKIP LOCKED`,
    [idMemorandum]
  );
  return rows[0] || null;
};

// El plazo de acuse corre desde que el aviso llegó al portal, no desde la emisión.
// Usa el reloj de la base, el mismo con el que se detectan los vencidos.
const marcarNotificado = async (db, idMemorandum, plazoHoras) => {
  const { rows } = await db.query(
    `UPDATE memorandums
        SET fue_notificado = TRUE,
            fecha_hora_notificacion = CURRENT_TIMESTAMP,
            fecha_limite_acuse = CURRENT_TIMESTAMP + make_interval(hours => $2::int)
      WHERE id_memorandum = $1 AND fue_notificado = FALSE
      RETURNING id_memorandum, fecha_hora_notificacion, fecha_limite_acuse`,
    [idMemorandum, plazoHoras]
  );
  return rows[0] || null;
};

// Emitidos cuyo aviso no llegó (NotificationService caído al emitir): el job los reintenta.
const listarSinNotificar = async (db, limite) => {
  const { rows } = await db.query(
    `SELECT id_memorandum
       FROM memorandums
      WHERE estado_sancion = 'EMITIDO' AND fue_notificado = FALSE
      ORDER BY fecha_emision, numero_correlativo
      LIMIT $1`,
    [limite]
  );
  return rows.map((fila) => fila.id_memorandum);
};

// Memorándums del colaborador visibles en su portal: solo los emitidos (no borradores ni anulados).
const listarRecibidos = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ACUSE}
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
      WHERE m.id_empleado_receptor = $1 AND m.estado_sancion = 'EMITIDO'
      ORDER BY (m.estado_acuse = 'RECIBIDO'), m.fecha_emision DESC, m.numero_correlativo DESC`,
    [idEmpleado]
  );
  return rows;
};

// Bloquea la fila: la apertura y el acuse no deben pisarse entre peticiones simultáneas.
const bloquearRecibido = async (db, idMemorandum, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ACUSE}, m.contenido_descripcion, m.estado_sancion,
            concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS emisor_nombre
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
       JOIN empleados e        ON e.id_empleado = m.id_empleado_emisor
      WHERE m.id_memorandum = $1 AND m.id_empleado_receptor = $2
        FOR UPDATE OF m`,
    [idMemorandum, idEmpleado]
  );
  return rows[0] || null;
};

// Solo la primera apertura queda registrada.
const registrarApertura = async (db, idMemorandum) => {
  const { rows } = await db.query(
    `UPDATE memorandums SET fecha_hora_apertura = COALESCE(fecha_hora_apertura, CURRENT_TIMESTAMP)
      WHERE id_memorandum = $1
      RETURNING fecha_hora_apertura`,
    [idMemorandum]
  );
  return rows[0].fecha_hora_apertura;
};

const registrarAcuse = async (db, idMemorandum, { ip, idUsuario, comentario }) => {
  const { rows } = await db.query(
    `UPDATE memorandums
        SET acuse_recibo_firmado = TRUE,
            estado_acuse = 'RECIBIDO',
            fecha_hora_acuse = CURRENT_TIMESTAMP,
            fecha_hora_apertura = COALESCE(fecha_hora_apertura, CURRENT_TIMESTAMP),
            ip_acuse = $2,
            id_usuario_acuse = $3,
            comentario_descargo = $4
      WHERE id_memorandum = $1 AND acuse_recibo_firmado = FALSE
      RETURNING id_memorandum, estado_acuse, fecha_hora_apertura, fecha_hora_acuse, ip_acuse,
                id_usuario_acuse, comentario_descargo`,
    [idMemorandum, ip, idUsuario, comentario]
  );
  return rows[0] || null;
};

// SKIP LOCKED: dos revisiones simultáneas no alertan dos veces por el mismo memorándum.
// `excluir` deja fuera los que ya fallaron en esta pasada para que no bloqueen al resto.
const bloquearVencidos = async (db, limite, excluir = []) => {
  const { rows } = await db.query(
    `SELECT m.id_memorandum
       FROM memorandums m
      WHERE m.estado_acuse = 'PENDIENTE'
        AND m.estado_sancion = 'EMITIDO'
        AND m.fecha_limite_acuse <= CURRENT_TIMESTAMP
        AND NOT (m.id_memorandum = ANY($2::uuid[]))
      ORDER BY m.fecha_limite_acuse
      LIMIT $1
        FOR UPDATE SKIP LOCKED`,
    [limite, excluir]
  );
  return rows.map((fila) => fila.id_memorandum);
};

const marcarVencido = async (db, idMemorandum) => {
  const { rows } = await db.query(
    `UPDATE memorandums SET estado_acuse = 'VENCIDO', fecha_hora_alerta_rrhh = CURRENT_TIMESTAMP
      WHERE id_memorandum = $1 AND estado_acuse = 'PENDIENTE'
      RETURNING id_memorandum, fecha_hora_alerta_rrhh`,
    [idMemorandum]
  );
  return rows[0] || null;
};

// Vista de RRHH: estado del acuse de cada memorándum emitido; `estadoAcuse` es opcional.
const listarSeguimiento = async (db, estadoAcuse) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ACUSE},
            concat_ws(' ', r.nombres, r.primer_apellido, r.segundo_apellido) AS receptor_nombre,
            concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS emisor_nombre
       FROM memorandums m
       JOIN tipos_memorandum t ON t.id_tipo_memo = m.id_tipo_memo
       JOIN empleados r        ON r.id_empleado = m.id_empleado_receptor
       JOIN empleados e        ON e.id_empleado = m.id_empleado_emisor
      WHERE m.estado_sancion = 'EMITIDO'
        AND ($1::text IS NULL OR m.estado_acuse = $1)
      ORDER BY CASE m.estado_acuse WHEN 'VENCIDO' THEN 0 WHEN 'PENDIENTE' THEN 1 ELSE 2 END,
               m.fecha_emision DESC, m.numero_correlativo DESC`,
    [estadoAcuse]
  );
  return rows;
};

module.exports = {
  obtenerParaAviso,
  bloquearSinNotificar,
  marcarNotificado,
  listarSinNotificar,
  listarRecibidos,
  bloquearRecibido,
  registrarApertura,
  registrarAcuse,
  bloquearVencidos,
  marcarVencido,
  listarSeguimiento,
  contarRecientes,
  siguienteCorrelativo,
  insertarAmonestacion,
  obtenerTipo,
  listarTipos,
  insertarReconocimiento,
  obtenerParaDocumento,
  listarPorEmpleado,
  guardarRutaPdf,
  obtenerDocumento,
};
