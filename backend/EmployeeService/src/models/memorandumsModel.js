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

const insertarBorrador = async (db, memorandum) => {
  const { rows } = await db.query(
    `INSERT INTO memorandums (
        id_memorandum, id_empleado_receptor, id_tipo_memo, id_empleado_emisor,
        codigo_cite, asunto, contenido_descripcion, fecha_emision,
        gestion, numero_correlativo, naturaleza_falta, gravedad_falta,
        estado_sancion, evidencia_adjunto_url
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'BORRADOR', $13)
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

// Datos del memorándum, del amonestado y del emisor que van impresos en el PDF oficial.
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

const guardarRutaPdf = async (db, idMemorandum, rutaPdf) => {
  const { rows } = await db.query(
    `UPDATE memorandums SET documento_pdf_url = $1 WHERE id_memorandum = $2 RETURNING ${COLUMNAS}`,
    [rutaPdf, idMemorandum]
  );
  return rows[0];
};

module.exports = {
  contarRecientes,
  siguienteCorrelativo,
  insertarBorrador,
  obtenerTipo,
  insertarReconocimiento,
  obtenerParaDocumento,
  guardarRutaPdf,
};
