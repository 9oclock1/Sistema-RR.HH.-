const { randomUUID } = require('node:crypto');

const DIAS_AVISO_VENCIMIENTO = 30;

const ESTADO_VIGENCIA = `
  CASE
    WHEN cc.fecha_vencimiento IS NULL THEN 'SIN_VENCIMIENTO'
    WHEN cc.fecha_vencimiento < CURRENT_DATE THEN 'VENCIDA'
    WHEN cc.fecha_vencimiento <= CURRENT_DATE + ${DIAS_AVISO_VENCIMIENTO} THEN 'POR_VENCER'
    ELSE 'VIGENTE'
  END
`;

const SELECT_CAPACITACION = `
  SELECT cc.id_capacitacion,
         cc.id_empleado,
         concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS empleado,
         cc.id_curso,
         cu.codigo AS curso_codigo,
         cu.nombre AS curso,
         cu.tipo_capacitacion,
         cu.horas_academicas,
         cc.institucion_emisora,
         cc.fecha_inicio,
         cc.fecha_fin,
         cc.fecha_emision,
         cc.fecha_vencimiento,
         ${ESTADO_VIGENCIA} AS estado_vigencia,
         (cc.fecha_vencimiento - CURRENT_DATE) AS dias_para_vencer,
         cc.certificado_adjunto_url,
         cc.certificado_nombre_original,
         cc.certificado_tipo_mime,
         cc.certificado_tamano_bytes,
         cc.id_solicitud_servicio,
         ss.numero_orden_servicio,
         ss.proveedor_nombre,
         cc.registrado_en,
         cc.actualizado_en
    FROM capacitaciones_certificacion cc
    JOIN cursos_capacitacion cu ON cu.id_curso = cc.id_curso
    JOIN empleados e            ON e.id_empleado = cc.id_empleado
    LEFT JOIN solicitudes_servicio_capacitacion ss ON ss.id_solicitud_servicio = cc.id_solicitud_servicio
`;

const listar = async (db, filtros) => {
  const condiciones = [];
  const valores = [];
  const agregar = (columna, valor) => {
    if (!valor) return;
    valores.push(valor);
    condiciones.push(`${columna} = $${valores.length}`);
  };

  agregar('cc.id_empleado', filtros.id_empleado);
  agregar('cc.id_curso', filtros.id_curso);
  agregar('cu.tipo_capacitacion', filtros.tipo_capacitacion);
  agregar(`(${ESTADO_VIGENCIA})`, filtros.estado_vigencia);

  const filtro = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await db.query(
    `${SELECT_CAPACITACION} ${filtro} ORDER BY cc.fecha_emision DESC, cc.registrado_en DESC`,
    valores
  );
  return rows;
};

const obtenerPorId = async (db, idCapacitacion) => {
  const { rows } = await db.query(`${SELECT_CAPACITACION} WHERE cc.id_capacitacion = $1`, [idCapacitacion]);
  return rows[0] || null;
};

const bloquearPorId = async (db, idCapacitacion) => {
  const { rows } = await db.query(
    `SELECT id_capacitacion, id_empleado, certificado_adjunto_url
       FROM capacitaciones_certificacion
      WHERE id_capacitacion = $1
      FOR UPDATE`,
    [idCapacitacion]
  );
  return rows[0] || null;
};

const existeRegistro = async (db, { id_empleado, id_curso, fecha_emision }, idExcluido = null) => {
  const { rows } = await db.query(
    `SELECT 1 FROM capacitaciones_certificacion
      WHERE id_empleado = $1 AND id_curso = $2 AND fecha_emision = $3
        AND ($4::uuid IS NULL OR id_capacitacion <> $4::uuid)
      LIMIT 1`,
    [id_empleado, id_curso, fecha_emision, idExcluido]
  );
  return rows.length > 0;
};

const obtenerSolicitudServicio = async (db, idSolicitud) => {
  const { rows } = await db.query(
    `SELECT id_solicitud_servicio, id_curso, estado
       FROM solicitudes_servicio_capacitacion
      WHERE id_solicitud_servicio = $1
      FOR SHARE`,
    [idSolicitud]
  );
  return rows[0] || null;
};

const sumarMeses = async (db, fecha, meses) => {
  const { rows } = await db.query('SELECT ($1::date + make_interval(months => $2::int))::date AS fecha', [fecha, meses]);
  return rows[0].fecha;
};

const insertar = async (db, capacitacion, certificado) => {
  const { rows } = await db.query(
    `INSERT INTO capacitaciones_certificacion (
       id_capacitacion, id_empleado, id_curso, institucion_emisora,
       fecha_inicio, fecha_fin, fecha_emision, fecha_vencimiento, id_solicitud_servicio,
       certificado_adjunto_url, certificado_nombre_original, certificado_tipo_mime, certificado_tamano_bytes
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING id_capacitacion`,
    [
      randomUUID(),
      capacitacion.id_empleado,
      capacitacion.id_curso,
      capacitacion.institucion_emisora,
      capacitacion.fecha_inicio,
      capacitacion.fecha_fin,
      capacitacion.fecha_emision,
      capacitacion.fecha_vencimiento,
      capacitacion.id_solicitud_servicio,
      certificado?.certificado_adjunto_url ?? null,
      certificado?.certificado_nombre_original ?? null,
      certificado?.certificado_tipo_mime ?? null,
      certificado?.certificado_tamano_bytes ?? null,
    ]
  );
  return rows[0].id_capacitacion;
};

const reemplazar = async (db, idCapacitacion, capacitacion) => {
  await db.query(
    `UPDATE capacitaciones_certificacion
        SET id_curso = $1,
            institucion_emisora = $2,
            fecha_inicio = $3,
            fecha_fin = $4,
            fecha_emision = $5,
            fecha_vencimiento = $6,
            id_solicitud_servicio = $7,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_capacitacion = $8`,
    [
      capacitacion.id_curso,
      capacitacion.institucion_emisora,
      capacitacion.fecha_inicio,
      capacitacion.fecha_fin,
      capacitacion.fecha_emision,
      capacitacion.fecha_vencimiento,
      capacitacion.id_solicitud_servicio,
      idCapacitacion,
    ]
  );
};

const guardarCertificado = async (db, idCapacitacion, certificado) => {
  await db.query(
    `UPDATE capacitaciones_certificacion
        SET certificado_adjunto_url = $1,
            certificado_nombre_original = $2,
            certificado_tipo_mime = $3,
            certificado_tamano_bytes = $4,
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_capacitacion = $5`,
    [
      certificado?.certificado_adjunto_url ?? null,
      certificado?.certificado_nombre_original ?? null,
      certificado?.certificado_tipo_mime ?? null,
      certificado?.certificado_tamano_bytes ?? null,
      idCapacitacion,
    ]
  );
};

const listarQueVencenEn = async (db, dias) => {
  const { rows } = await db.query(
    `SELECT cc.id_capacitacion,
            cc.id_empleado,
            concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS empleado,
            e.correo_personal,
            cu.codigo AS curso_codigo,
            cu.nombre AS curso,
            cu.tipo_capacitacion,
            cc.institucion_emisora,
            cc.fecha_emision,
            cc.fecha_vencimiento
       FROM capacitaciones_certificacion cc
       JOIN cursos_capacitacion cu ON cu.id_curso = cc.id_curso
       JOIN empleados e            ON e.id_empleado = cc.id_empleado
       JOIN estados_empleado ee    ON ee.id_estado_empleado = e.id_estado_empleado
      WHERE cc.fecha_vencimiento = CURRENT_DATE + $1::int
        AND ee.permite_acceso
      ORDER BY e.primer_apellido, e.nombres, cu.nombre`,
    [dias]
  );
  return rows;
};

const eliminar = async (db, idCapacitacion) => {
  await db.query('DELETE FROM capacitaciones_certificacion WHERE id_capacitacion = $1', [idCapacitacion]);
};

module.exports = {
  DIAS_AVISO_VENCIMIENTO,
  listar,
  obtenerPorId,
  bloquearPorId,
  existeRegistro,
  obtenerSolicitudServicio,
  sumarMeses,
  insertar,
  reemplazar,
  guardarCertificado,
  listarQueVencenEn,
  eliminar,
};
