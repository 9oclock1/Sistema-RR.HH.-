const { randomUUID } = require('node:crypto');


const ESTADO_SQL = `
  CASE
    WHEN c.fecha_publicacion = 'infinity' THEN 'borrador'
    WHEN c.esta_activa AND c.fecha_limite_postulacion >= CURRENT_DATE THEN 'publicada'
    ELSE 'cerrada'
  END`;

const SELECT_CONVOCATORIA = `
  SELECT
    c.id_convocatoria,
    c.codigo_convocatoria,
    c.id_cargo_referencial,
    c.id_sucursal_destino,
    c.titulo_puesto,
    c.descripcion_puesto,
    c.cantidad_vacantes,
    c.year_experiencia_min,
    c.nivel_educacion_min,
    c.habilidades_clave_requeridas,
    NULLIF(c.fecha_publicacion, 'infinity') AS fecha_publicacion,
    NULLIF(c.fecha_limite_postulacion, 'infinity') AS fecha_limite_postulacion,
    c.esta_activa,
    c.creado_en,
    ${ESTADO_SQL} AS estado
  FROM convocatorias c
`;
const aConvocatoria = (fila) => ({ ...fila, year_experiencia_min: Number(fila.year_experiencia_min) });

const listar = async (db, { estado } = {}) => {
  const valores = [];
  let query = `SELECT * FROM (${SELECT_CONVOCATORIA}) t`;

  if (estado) {
    valores.push(estado);
    query += ` WHERE t.estado = $${valores.length}`;
  }

  query += ' ORDER BY t.creado_en DESC';
  const { rows } = await db.query(query, valores);
  return rows.map(aConvocatoria);
};

const obtenerPorId = async (db, idConvocatoria) => {
  const { rows } = await db.query(`${SELECT_CONVOCATORIA} WHERE c.id_convocatoria = $1`, [idConvocatoria]);
  return rows[0] ? aConvocatoria(rows[0]) : null;
};

const bloquearPorId = async (db, idConvocatoria) => {
  const { rows } = await db.query(`${SELECT_CONVOCATORIA} WHERE c.id_convocatoria = $1 FOR UPDATE OF c`, [
    idConvocatoria,
  ]);
  return rows[0] ? aConvocatoria(rows[0]) : null;
};

const generarCodigo = async (db) => {
  await db.query(`SELECT pg_advisory_xact_lock(hashtext('convocatorias.codigo_convocatoria'))`);
  const { rows } = await db.query(
    `SELECT to_char(CURRENT_DATE, 'YYYY') AS anio,
            COALESCE(MAX(substring(codigo_convocatoria FROM '^CONV-\\d{4}-(\\d+)$')::int), 0) + 1 AS siguiente
       FROM convocatorias
      WHERE codigo_convocatoria LIKE 'CONV-' || to_char(CURRENT_DATE, 'YYYY') || '-%'`
  );
  const { anio, siguiente } = rows[0];
  return `CONV-${anio}-${String(siguiente).padStart(4, '0')}`;
};

const insertarBorrador = async (db, convocatoria) => {
  const { rows } = await db.query(
    `INSERT INTO convocatorias (
       id_convocatoria, id_cargo_referencial, id_sucursal_destino, codigo_convocatoria, titulo_puesto,
       descripcion_puesto, cantidad_vacantes, year_experiencia_min, nivel_educacion_min,
       habilidades_clave_requeridas, fecha_publicacion, fecha_limite_postulacion, esta_activa
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'infinity', COALESCE($11::date, 'infinity'), FALSE)
     RETURNING id_convocatoria`,
    [
      randomUUID(),
      convocatoria.id_cargo_referencial,
      convocatoria.id_sucursal_destino,
      convocatoria.codigo_convocatoria,
      convocatoria.titulo_puesto,
      convocatoria.descripcion_puesto,
      convocatoria.cantidad_vacantes,
      convocatoria.year_experiencia_min,
      convocatoria.nivel_educacion_min,
      convocatoria.habilidades_clave_requeridas,
      convocatoria.fecha_limite_postulacion,
    ]
  );
  return rows[0].id_convocatoria;
};

const CAMPOS_EDITABLES = [
  'id_cargo_referencial',
  'id_sucursal_destino',
  'titulo_puesto',
  'descripcion_puesto',
  'cantidad_vacantes',
  'year_experiencia_min',
  'nivel_educacion_min',
  'habilidades_clave_requeridas',
  'fecha_limite_postulacion',
];

const actualizar = async (db, idConvocatoria, cambios) => {
  const valores = [];
  const asignaciones = [];

  CAMPOS_EDITABLES.filter((campo) => campo in cambios).forEach((campo) => {
    valores.push(cambios[campo]);
    const parametro = `$${valores.length}`;
    asignaciones.push(
      campo === 'fecha_limite_postulacion'
        ? `${campo} = COALESCE(${parametro}::date, 'infinity')`
        : `${campo} = ${parametro}`
    );
  });

  if (asignaciones.length === 0) return;
  valores.push(idConvocatoria);
  await db.query(
    `UPDATE convocatorias SET ${asignaciones.join(', ')} WHERE id_convocatoria = $${valores.length}`,
    valores
  );
};

const publicar = async (db, idConvocatoria) => {
  await db.query(
    `UPDATE convocatorias SET esta_activa = TRUE, fecha_publicacion = CURRENT_DATE WHERE id_convocatoria = $1`,
    [idConvocatoria]
  );
};

const cerrar = async (db, idConvocatoria) => {
  await db.query('UPDATE convocatorias SET esta_activa = FALSE WHERE id_convocatoria = $1', [idConvocatoria]);
};

module.exports = {
  ESTADO_SQL,
  listar,
  obtenerPorId,
  bloquearPorId,
  generarCodigo,
  insertarBorrador,
  actualizar,
  publicar,
  cerrar,
};
