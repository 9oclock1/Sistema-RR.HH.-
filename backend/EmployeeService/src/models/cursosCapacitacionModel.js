const { randomUUID } = require('node:crypto');

const SELECT_CURSO = `
  SELECT id_curso,
         codigo,
         nombre,
         descripcion,
         horas_academicas,
         tipo_capacitacion,
         requiere_vencimiento,
         meses_vigencia,
         esta_activo
    FROM cursos_capacitacion
`;

const listar = async (db, { tipo_capacitacion, incluir_inactivos }) => {
  const condiciones = [];
  const valores = [];

  if (!incluir_inactivos) condiciones.push('esta_activo = TRUE');
  if (tipo_capacitacion) {
    valores.push(tipo_capacitacion);
    condiciones.push(`tipo_capacitacion = $${valores.length}`);
  }

  const filtro = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { rows } = await db.query(`${SELECT_CURSO} ${filtro} ORDER BY nombre ASC, codigo ASC`, valores);
  return rows;
};

const obtenerPorId = async (db, idCurso) => {
  const { rows } = await db.query(`${SELECT_CURSO} WHERE id_curso = $1`, [idCurso]);
  return rows[0] || null;
};

const bloquearPorId = async (db, idCurso) => {
  const { rows } = await db.query(`${SELECT_CURSO} WHERE id_curso = $1 FOR UPDATE`, [idCurso]);
  return rows[0] || null;
};

const obtenerParaRegistro = async (db, idCurso) => {
  const { rows } = await db.query(`${SELECT_CURSO} WHERE id_curso = $1 FOR SHARE`, [idCurso]);
  return rows[0] || null;
};

const existeCodigo = async (db, codigo, idCursoExcluido = null) => {
  const { rows } = await db.query(
    `SELECT 1 FROM cursos_capacitacion
      WHERE lower(codigo) = lower($1)
        AND ($2::uuid IS NULL OR id_curso <> $2::uuid)
      LIMIT 1`,
    [codigo, idCursoExcluido]
  );
  return rows.length > 0;
};

const insertar = async (db, curso) => {
  const { rows } = await db.query(
    `INSERT INTO cursos_capacitacion (
       id_curso, codigo, nombre, descripcion, horas_academicas,
       tipo_capacitacion, requiere_vencimiento, meses_vigencia
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_curso`,
    [
      randomUUID(),
      curso.codigo,
      curso.nombre,
      curso.descripcion,
      curso.horas_academicas,
      curso.tipo_capacitacion,
      curso.requiere_vencimiento,
      curso.meses_vigencia,
    ]
  );
  return rows[0].id_curso;
};

const reemplazar = async (db, idCurso, curso) => {
  await db.query(
    `UPDATE cursos_capacitacion
        SET codigo = $1,
            nombre = $2,
            descripcion = $3,
            horas_academicas = $4,
            tipo_capacitacion = $5,
            requiere_vencimiento = $6,
            meses_vigencia = $7
      WHERE id_curso = $8`,
    [
      curso.codigo,
      curso.nombre,
      curso.descripcion,
      curso.horas_academicas,
      curso.tipo_capacitacion,
      curso.requiere_vencimiento,
      curso.meses_vigencia,
      idCurso,
    ]
  );
};

const darDeBaja = async (db, idCurso) => {
  await db.query('UPDATE cursos_capacitacion SET esta_activo = FALSE WHERE id_curso = $1', [idCurso]);
};

module.exports = {
  listar,
  obtenerPorId,
  bloquearPorId,
  obtenerParaRegistro,
  existeCodigo,
  insertar,
  reemplazar,
  darDeBaja,
};
