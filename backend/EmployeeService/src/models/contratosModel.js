const { randomUUID } = require('node:crypto');

const SELECT_HISTORIAL = `
  WITH versiones AS (
    SELECT k.*,
           ROW_NUMBER() OVER w AS numero_version,
           LEAD(lower(k.periodo_vigencia)) OVER w AS inicio_siguiente
      FROM contratos k
     WHERE k.id_empleado = $1
    WINDOW w AS (ORDER BY lower(k.periodo_vigencia), k.registrado_en)
  )
  SELECT v.id_contrato,
         v.id_empleado,
         v.numero_version::int AS numero_version,
         v.numero_contrato,
         v.tipo_modificacion,
         v.es_adenda,
         v.id_contrato_anterior,
         ant.numero_contrato AS numero_contrato_anterior,
         v.id_tipo_contrato,
         tc.codigo AS tipo_contrato_codigo,
         tc.nombre AS tipo_contrato,
         v.id_tipo_jornada,
         tj.codigo AS tipo_jornada_codigo,
         tj.nombre AS tipo_jornada,
         tj.horas_semanales,
         v.haber_mensual_pactado,
         lower(v.periodo_vigencia) AS fecha_vigencia,
         upper(v.periodo_vigencia) - 1 AS fecha_fin_contrato,
         LEAST(upper(v.periodo_vigencia), v.inicio_siguiente) - 1 AS vigente_hasta,
         daterange(lower(v.periodo_vigencia), LEAST(upper(v.periodo_vigencia), v.inicio_siguiente)) @> CURRENT_DATE AS es_version_vigente,
         v.motivo_adenda AS justificacion,
         v.documento_adjunto_url,
         v.documento_nombre_original,
         v.documento_tipo_mime,
         v.documento_tamano_bytes,
         v.documento_hash_sha256,
         v.registrado_por,
         NULLIF(concat_ws(' ', r.nombres, r.primer_apellido, r.segundo_apellido), '') AS registrado_por_nombre,
         v.registrado_rol,
         v.registrado_en
    FROM versiones v
    JOIN tipos_contrato tc  ON tc.id_tipo_contrato = v.id_tipo_contrato
    JOIN tipos_jornada tj   ON tj.id_tipo_jornada = v.id_tipo_jornada
    LEFT JOIN contratos ant ON ant.id_contrato = v.id_contrato_anterior
    LEFT JOIN empleados r   ON r.id_empleado = v.registrado_por
`;

const listarHistorial = async (db, idEmpleado) => {
  const { rows } = await db.query(`${SELECT_HISTORIAL} ORDER BY v.numero_version`, [idEmpleado]);
  return rows;
};

const obtenerVersion = async (db, idEmpleado, idContrato) => {
  const { rows } = await db.query(`${SELECT_HISTORIAL} WHERE v.id_contrato = $2`, [idEmpleado, idContrato]);
  return rows[0] || null;
};

const existeEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query('SELECT 1 FROM empleados WHERE id_empleado = $1', [idEmpleado]);
  return rows.length > 0;
};

const bloquearEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query('SELECT id_empleado FROM empleados WHERE id_empleado = $1 FOR NO KEY UPDATE', [idEmpleado]);
  return rows.length > 0;
};

const obtenerVersionActual = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT k.id_contrato,
            k.numero_contrato,
            k.id_tipo_contrato,
            k.id_tipo_jornada,
            k.haber_mensual_pactado,
            lower(k.periodo_vigencia) AS fecha_vigencia,
            upper(k.periodo_vigencia) - 1 AS fecha_fin
       FROM contratos k
      WHERE k.id_empleado = $1
        AND NOT EXISTS (SELECT 1 FROM contratos s WHERE s.id_contrato_anterior = k.id_contrato)
      ORDER BY lower(k.periodo_vigencia) DESC, k.registrado_en DESC
      LIMIT 1`,
    [idEmpleado]
  );
  return rows[0] || null;
};

const buscarSolapamiento = async (db, idEmpleado, fechaInicio, fechaFin) => {
  const { rows } = await db.query(
    `SELECT numero_contrato,
            lower(periodo_vigencia) AS fecha_inicio,
            upper(periodo_vigencia) - 1 AS fecha_fin
       FROM contratos
      WHERE id_empleado = $1
        AND periodo_vigencia && daterange($2::date, $3::date, '[]')
      ORDER BY lower(periodo_vigencia)
      LIMIT 1`,
    [idEmpleado, fechaInicio, fechaFin]
  );
  return rows[0] || null;
};

const existeNumero = async (db, numeroContrato) => {
  const { rows } = await db.query('SELECT 1 FROM contratos WHERE numero_contrato = $1', [numeroContrato]);
  return rows.length > 0;
};

const insertar = async (db, version) => {
  const { rows } = await db.query(
    `INSERT INTO contratos (
       id_contrato, id_empleado, id_tipo_contrato, id_tipo_jornada, numero_contrato, periodo_vigencia,
       haber_mensual_pactado, es_adenda, motivo_adenda, tipo_modificacion, id_contrato_anterior,
       documento_adjunto_url, documento_nombre_original, documento_tipo_mime, documento_tamano_bytes, documento_hash_sha256,
       registrado_por, registrado_rol
     )
     VALUES ($1, $2, $3, $4, $5, daterange($6::date, $7::date, '[]'), $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
     RETURNING id_contrato`,
    [
      randomUUID(),
      version.id_empleado,
      version.id_tipo_contrato,
      version.id_tipo_jornada,
      version.numero_contrato,
      version.fecha_vigencia,
      version.fecha_fin,
      version.haber_mensual_pactado,
      version.es_adenda,
      version.justificacion,
      version.tipo_modificacion,
      version.id_contrato_anterior,
      version.documento.documento_adjunto_url,
      version.documento.documento_nombre_original,
      version.documento.documento_tipo_mime,
      version.documento.documento_tamano_bytes,
      version.documento.documento_hash_sha256,
      version.registrado_por,
      version.registrado_rol,
    ]
  );
  return rows[0].id_contrato;
};

const obtenerDocumento = async (db, idContrato) => {
  const { rows } = await db.query(
    `SELECT documento_adjunto_url, documento_nombre_original, documento_tipo_mime
       FROM contratos
      WHERE id_contrato = $1`,
    [idContrato]
  );
  return rows[0] || null;
};

const listarCatalogos = async (db) => {
  const [tiposContrato, tiposJornada] = await Promise.all([
    db.query('SELECT id_tipo_contrato, codigo, nombre FROM tipos_contrato ORDER BY nombre'),
    db.query('SELECT id_tipo_jornada, codigo, nombre, horas_semanales FROM tipos_jornada ORDER BY horas_semanales DESC, nombre'),
  ]);
  return { tipos_contrato: tiposContrato.rows, tipos_jornada: tiposJornada.rows };
};

module.exports = {
  listarHistorial,
  obtenerVersion,
  existeEmpleado,
  bloquearEmpleado,
  obtenerVersionActual,
  buscarSolapamiento,
  existeNumero,
  insertar,
  obtenerDocumento,
  listarCatalogos,
};
