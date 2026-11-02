const pool = require("../config/db");

// Las funciones que escriben reciben el cliente de la transacción en curso.

async function listar() {
  const { rows } = await pool.query(
    `SELECT p.*,
            COUNT(DISTINCT c.id_criterio)::int AS total_criterios,
            COUNT(q.id_pregunta)::int AS total_preguntas,
            COALESCE(SUM(q.peso), 0) AS suma_pesos
     FROM plantillas_evaluacion p
     LEFT JOIN criterios_evaluacion c ON c.id_plantilla = p.id_plantilla
     LEFT JOIN preguntas_evaluacion q ON q.id_criterio = c.id_criterio
     GROUP BY p.id_plantilla
     ORDER BY p.nombre, p.version DESC`
  );
  return rows;
}

async function obtener(id, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT * FROM plantillas_evaluacion WHERE id_plantilla = $1 ${bloquear ? "FOR UPDATE" : ""}`,
    [id]
  );
  return rows[0];
}

// Criterios con sus preguntas y los niveles de cada escala, en orden.
async function obtenerContenido(id, db = pool) {
  const [criterios, preguntas, niveles] = await Promise.all([
    db.query(
      `SELECT id_criterio, nombre, descripcion FROM criterios_evaluacion
       WHERE id_plantilla = $1 ORDER BY orden`,
      [id]
    ),
    db.query(
      `SELECT q.id_pregunta, q.id_criterio, q.enunciado, q.peso, q.tipo_escala, q.valor_minimo, q.valor_maximo
       FROM preguntas_evaluacion q JOIN criterios_evaluacion c USING (id_criterio)
       WHERE c.id_plantilla = $1 ORDER BY q.orden`,
      [id]
    ),
    db.query(
      `SELECT n.id_pregunta, n.valor, n.etiqueta
       FROM niveles_escala n
       JOIN preguntas_evaluacion q USING (id_pregunta)
       JOIN criterios_evaluacion c USING (id_criterio)
       WHERE c.id_plantilla = $1 ORDER BY n.valor`,
      [id]
    ),
  ]);

  return criterios.rows.map((criterio) => ({
    ...criterio,
    preguntas: preguntas.rows
      .filter((pregunta) => pregunta.id_criterio === criterio.id_criterio)
      .map(({ id_criterio, ...pregunta }) => ({
        ...pregunta,
        niveles: niveles.rows
          .filter((nivel) => nivel.id_pregunta === pregunta.id_pregunta)
          .map(({ valor, etiqueta }) => ({ valor, etiqueta })),
      })),
  }));
}

// Sin idFamilia inicia una plantilla nueva: la familia toma el id de su primera versión.
async function crear(db, { nombre, descripcion }, { idFamilia = null, version = 1 } = {}) {
  const { rows } = await db.query(
    `INSERT INTO plantillas_evaluacion (id_plantilla, id_familia, version, nombre, descripcion)
     SELECT id, COALESCE($1::uuid, id), $2::smallint, $3::varchar, $4::varchar FROM gen_random_uuid() AS id
     RETURNING id_plantilla`,
    [idFamilia, version, nombre, descripcion]
  );
  return rows[0].id_plantilla;
}

async function actualizarDatos(db, id, { nombre, descripcion }) {
  await db.query(
    `UPDATE plantillas_evaluacion SET nombre = $1, descripcion = $2, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_plantilla = $3`,
    [nombre, descripcion, id]
  );
}

// Reemplaza todo el contenido: el borrador se guarda como un documento completo.
async function reemplazarContenido(db, id, criterios) {
  await db.query("DELETE FROM criterios_evaluacion WHERE id_plantilla = $1", [id]);
  for (const [ordenCriterio, criterio] of criterios.entries()) {
    const { rows } = await db.query(
      `INSERT INTO criterios_evaluacion (id_plantilla, nombre, descripcion, orden)
       VALUES ($1, $2, $3, $4) RETURNING id_criterio`,
      [id, criterio.nombre, criterio.descripcion, ordenCriterio]
    );
    const { id_criterio } = rows[0];
    for (const [ordenPregunta, pregunta] of criterio.preguntas.entries()) {
      const insertada = await db.query(
        `INSERT INTO preguntas_evaluacion (id_criterio, enunciado, peso, tipo_escala, valor_minimo, valor_maximo, orden)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_pregunta`,
        [
          id_criterio,
          pregunta.enunciado,
          pregunta.peso,
          pregunta.tipo_escala,
          pregunta.valor_minimo,
          pregunta.valor_maximo,
          ordenPregunta,
        ]
      );
      if (pregunta.niveles.length > 0) {
        await db.query(
          `INSERT INTO niveles_escala (id_pregunta, valor, etiqueta)
           SELECT $1::uuid, * FROM UNNEST($2::numeric[], $3::varchar[])`,
          [
            insertada.rows[0].id_pregunta,
            pregunta.niveles.map((nivel) => nivel.valor),
            pregunta.niveles.map((nivel) => nivel.etiqueta),
          ]
        );
      }
    }
  }
}

async function obtenerBorradorFamilia(db, idFamilia) {
  const { rows } = await db.query(
    "SELECT * FROM plantillas_evaluacion WHERE id_familia = $1 AND estado = 'BORRADOR'",
    [idFamilia]
  );
  return rows[0];
}

async function siguienteVersion(db, idFamilia) {
  const { rows } = await db.query(
    "SELECT MAX(version)::int + 1 AS version FROM plantillas_evaluacion WHERE id_familia = $1",
    [idFamilia]
  );
  return rows[0].version;
}

// La versión publicada reemplaza a la anterior, que queda archivada para las evaluaciones que ya la usan.
async function publicar(db, id, idFamilia) {
  await db.query(
    `UPDATE plantillas_evaluacion SET estado = 'ARCHIVADA', actualizado_en = CURRENT_TIMESTAMP
     WHERE id_familia = $1 AND estado = 'PUBLICADA'`,
    [idFamilia]
  );
  await db.query(
    `UPDATE plantillas_evaluacion
     SET estado = 'PUBLICADA', publicada_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_plantilla = $1`,
    [id]
  );
}

async function eliminar(db, id) {
  await db.query("DELETE FROM plantillas_evaluacion WHERE id_plantilla = $1", [id]);
}

module.exports = {
  listar,
  obtener,
  obtenerContenido,
  crear,
  actualizarDatos,
  reemplazarContenido,
  obtenerBorradorFamilia,
  siguienteVersion,
  publicar,
  eliminar,
};
