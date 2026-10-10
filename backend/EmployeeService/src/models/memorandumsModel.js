const { randomUUID } = require('node:crypto');

// Amonestaciones del empleado en los últimos `meses`; las anuladas no cuentan.
const contarRecientes = async (db, idEmpleadoReceptor, meses) => {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS total
       FROM memorandums
      WHERE id_empleado_receptor = $1
        AND estado_sancion <> 'ANULADO'
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
     RETURNING id_memorandum, id_empleado_receptor, id_tipo_memo, id_empleado_emisor,
               codigo_cite, asunto, contenido_descripcion, fecha_emision,
               gestion, numero_correlativo, naturaleza_falta, gravedad_falta,
               estado_sancion, evidencia_adjunto_url, documento_pdf_url`,
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

module.exports = { contarRecientes, siguienteCorrelativo, insertarBorrador };
