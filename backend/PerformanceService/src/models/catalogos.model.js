const pool = require("../config/db");
const { ESTADO_VERSION } = require("../utils/catalogos");

// Escalas de valoración (ESCALAS_VALORACION + NIVELES_ESCALA) y competencias (COMPETENCIAS):
// catálogos comunes a todas las plantillas.

const USO_ESCALA = `
  EXISTS (SELECT 1 FROM preguntas_evaluacion q WHERE q.id_escala = e.id_escala) AS en_uso,
  EXISTS (SELECT 1 FROM preguntas_evaluacion q
            JOIN criterios_evaluacion c ON c.id_criterio = q.id_criterio
            JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion
            JOIN versiones_plantilla v ON v.id_version = s.id_version
           WHERE q.id_escala = e.id_escala AND v.id_estado_version <> ${ESTADO_VERSION.BORRADOR}) AS en_uso_publicado`;

async function listarEscalas(db = pool) {
  const escalas = await db.query(
    `SELECT e.id_escala, e.nombre, e.descripcion, te.codigo AS tipo, ${USO_ESCALA}
     FROM escalas_valoracion e
     JOIN catalogos_tipo_escala te ON te.id_tipo_escala = e.id_tipo_escala
     ORDER BY e.nombre`
  );
  const niveles = await db.query("SELECT id_nivel, id_escala, valor, etiqueta FROM niveles_escala ORDER BY valor");
  return escalas.rows.map((escala) => ({
    ...escala,
    niveles: niveles.rows
      .filter((nivel) => nivel.id_escala === escala.id_escala)
      .map(({ id_escala, ...nivel }) => nivel),
  }));
}

async function obtenerEscala(idEscala, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT e.id_escala, e.nombre, e.descripcion, e.id_tipo_escala, te.codigo AS tipo, ${USO_ESCALA}
     FROM escalas_valoracion e
     JOIN catalogos_tipo_escala te ON te.id_tipo_escala = e.id_tipo_escala
     WHERE e.id_escala = $1
     ${bloquear ? "FOR UPDATE OF e" : ""}`,
    [idEscala]
  );
  if (!rows[0]) return undefined;
  const niveles = await db.query(
    "SELECT id_nivel, valor, etiqueta FROM niveles_escala WHERE id_escala = $1 ORDER BY valor",
    [idEscala]
  );
  return { ...rows[0], niveles: niveles.rows };
}

async function reemplazarNiveles(db, idEscala, niveles) {
  await db.query("DELETE FROM niveles_escala WHERE id_escala = $1", [idEscala]);
  await db.query(
    `INSERT INTO niveles_escala (id_escala, valor, etiqueta)
     SELECT $1::uuid, * FROM UNNEST($2::numeric[], $3::varchar[])`,
    [idEscala, niveles.map((n) => n.valor), niveles.map((n) => n.etiqueta)]
  );
}

async function crearEscala(db, { nombre, descripcion, id_tipo_escala, niveles }) {
  const { rows } = await db.query(
    `INSERT INTO escalas_valoracion (id_tipo_escala, nombre, descripcion) VALUES ($1, $2, $3) RETURNING id_escala`,
    [id_tipo_escala, nombre, descripcion]
  );
  await reemplazarNiveles(db, rows[0].id_escala, niveles);
  return rows[0].id_escala;
}

// Con niveles = null conserva el tipo y los niveles actuales.
async function actualizarEscala(db, idEscala, { nombre, descripcion, id_tipo_escala }, niveles) {
  await db.query(
    `UPDATE escalas_valoracion SET nombre = $1, descripcion = $2, id_tipo_escala = $3 WHERE id_escala = $4`,
    [nombre, descripcion, id_tipo_escala, idEscala]
  );
  if (niveles) await reemplazarNiveles(db, idEscala, niveles);
}

async function eliminarEscala(db, idEscala) {
  await db.query("DELETE FROM niveles_escala WHERE id_escala = $1", [idEscala]);
  await db.query("DELETE FROM escalas_valoracion WHERE id_escala = $1", [idEscala]);
}

async function listarCompetencias(db = pool) {
  const { rows } = await db.query(
    `SELECT co.id_competencia, co.nombre, co.descripcion, tc.codigo AS tipo, tc.nombre AS tipo_nombre
     FROM competencias co
     JOIN catalogos_tipo_competencia tc ON tc.id_tipo_competencia = co.id_tipo_competencia
     WHERE co.esta_activa
     ORDER BY tc.id_tipo_competencia, co.nombre`
  );
  return rows;
}

async function crearCompetencia({ nombre, descripcion, id_tipo_competencia }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO competencias (id_tipo_competencia, nombre, descripcion) VALUES ($1, $2, $3)
     RETURNING id_competencia`,
    [id_tipo_competencia, nombre, descripcion]
  );
  const { rows: creada } = await db.query(
    `SELECT co.id_competencia, co.nombre, co.descripcion, tc.codigo AS tipo, tc.nombre AS tipo_nombre
     FROM competencias co
     JOIN catalogos_tipo_competencia tc ON tc.id_tipo_competencia = co.id_tipo_competencia
     WHERE co.id_competencia = $1`,
    [rows[0].id_competencia]
  );
  return creada[0];
}

module.exports = {
  listarEscalas,
  obtenerEscala,
  crearEscala,
  actualizarEscala,
  eliminarEscala,
  listarCompetencias,
  crearCompetencia,
};
