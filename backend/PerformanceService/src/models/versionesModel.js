const pool = require("../config/db");
const { ESTADO_VERSION } = require("../utils/plantillas");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

async function hoy(db = pool) {
  const { rows } = await db.query(`SELECT ${HOY_BOLIVIA} AS hoy`);
  return rows[0].hoy;
}

// La versión debe pertenecer a la plantilla indicada.
async function obtener(idPlantilla, idVersion, { bloquear = false } = {}, db = pool) {
  const { rows } = await db.query(
    `SELECT v.id_version, v.id_plantilla, v.numero_version, v.id_estado_version,
            ev.codigo AS estado_codigo, ev.nombre AS estado_nombre,
            v.publicada_en, v.creado_en, trim(em.nombres || ' ' || em.apellidos) AS publicador
     FROM versiones_plantilla v
     JOIN catalogos_estado_version ev ON ev.id_estado_version = v.id_estado_version
     LEFT JOIN empleados em ON em.id_empleado = v.id_empleado_publicador
     WHERE v.id_version = $1 AND v.id_plantilla = $2${bloquear ? " FOR UPDATE OF v" : ""}`,
    [idVersion, idPlantilla],
  );
  return rows[0] ?? null;
}

async function listarSecciones(idVersion, db = pool) {
  const { rows } = await db.query(
    `SELECT s.id_seccion, s.orden, c.id_competencia, c.nombre, c.descripcion, c.esta_activa,
            t.codigo AS tipo_codigo, t.nombre AS tipo_nombre
     FROM secciones_plantilla s
     JOIN competencias c ON c.id_competencia = s.id_competencia
     JOIN catalogos_tipo_competencia t ON t.id_tipo_competencia = c.id_tipo_competencia
     WHERE s.id_version = $1
     ORDER BY s.orden`,
    [idVersion],
  );
  return rows;
}

async function listarCriterios(idVersion, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id_criterio, c.id_seccion, c.nombre, c.descripcion, c.orden
     FROM criterios_evaluacion c JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion
     WHERE s.id_version = $1
     ORDER BY c.orden`,
    [idVersion],
  );
  return rows;
}

async function listarPreguntas(idVersion, db = pool) {
  const { rows } = await db.query(
    `SELECT q.id_pregunta, q.id_criterio, q.id_escala, q.texto, q.peso_porcentual, q.es_obligatoria, q.orden
     FROM preguntas_evaluacion q
     JOIN criterios_evaluacion c ON c.id_criterio = q.id_criterio
     JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion
     WHERE s.id_version = $1
     ORDER BY q.orden`,
    [idVersion],
  );
  return rows;
}

async function escalasExistentes(ids, db = pool) {
  const { rows } = await db.query(`SELECT id_escala FROM escalas_valoracion WHERE id_escala = ANY($1::uuid[])`, [ids]);
  return new Set(rows.map((fila) => fila.id_escala));
}

async function listarCompetencias(ids, db = pool) {
  const { rows } = await db.query(
    `SELECT id_competencia, nombre, esta_activa FROM competencias WHERE id_competencia = ANY($1::uuid[])`,
    [ids],
  );
  return rows;
}

// Deja las secciones de la versión como indica la lista de competencias, en ese orden. Las secciones que se
// conservan mantienen su id (y con él los criterios y preguntas que ya tengan); las que se quitan se borran con ellos.
async function reemplazarSecciones(idVersion, idsCompetencia, db = pool) {
  const { rows: existentes } = await db.query(
    `SELECT id_seccion, id_competencia FROM secciones_plantilla WHERE id_version = $1`,
    [idVersion],
  );
  const conservadas = new Map(
    existentes.filter((s) => idsCompetencia.includes(s.id_competencia)).map((s) => [s.id_competencia, s.id_seccion]),
  );
  const quitadas = existentes.filter((s) => !conservadas.has(s.id_competencia)).map((s) => s.id_seccion);

  if (quitadas.length > 0) {
    await db.query(
      `DELETE FROM preguntas_evaluacion WHERE id_criterio IN (SELECT id_criterio FROM criterios_evaluacion WHERE id_seccion = ANY($1::uuid[]))`,
      [quitadas],
    );
    await db.query(`DELETE FROM criterios_evaluacion WHERE id_seccion = ANY($1::uuid[])`, [quitadas]);
    await db.query(`DELETE FROM secciones_plantilla WHERE id_seccion = ANY($1::uuid[])`, [quitadas]);
  }

  // Se apartan los órdenes actuales para que el cambio de posiciones no choque con uq_seccion_version_orden.
  await db.query(`UPDATE secciones_plantilla SET orden = orden + 1000 WHERE id_version = $1`, [idVersion]);
  for (const [posicion, idCompetencia] of idsCompetencia.entries()) {
    const orden = posicion + 1;
    const idSeccion = conservadas.get(idCompetencia);
    if (idSeccion) {
      await db.query(`UPDATE secciones_plantilla SET orden = $2 WHERE id_seccion = $1`, [idSeccion, orden]);
    } else {
      await db.query(
        `INSERT INTO secciones_plantilla (id_version, id_competencia, orden) VALUES ($1, $2, $3)`,
        [idVersion, idCompetencia, orden],
      );
    }
  }
}

// Deja la estructura de la versión exactamente como la lista indica: secciones, criterios y preguntas, en ese orden.
async function reemplazarEstructura(idVersion, secciones, db = pool) {
  await db.query(
    `DELETE FROM preguntas_evaluacion WHERE id_criterio IN (
       SELECT c.id_criterio FROM criterios_evaluacion c
       JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion WHERE s.id_version = $1)`,
    [idVersion],
  );
  await db.query(
    `DELETE FROM criterios_evaluacion WHERE id_seccion IN (SELECT id_seccion FROM secciones_plantilla WHERE id_version = $1)`,
    [idVersion],
  );
  await db.query(`DELETE FROM secciones_plantilla WHERE id_version = $1`, [idVersion]);

  for (const [posicionSeccion, seccion] of secciones.entries()) {
    const { rows: nuevaSeccion } = await db.query(
      `INSERT INTO secciones_plantilla (id_version, id_competencia, orden) VALUES ($1, $2, $3) RETURNING id_seccion`,
      [idVersion, seccion.id_competencia, posicionSeccion + 1],
    );
    for (const [posicionCriterio, criterio] of seccion.criterios.entries()) {
      const { rows: nuevoCriterio } = await db.query(
        `INSERT INTO criterios_evaluacion (id_seccion, nombre, descripcion, orden) VALUES ($1, $2, $3, $4) RETURNING id_criterio`,
        [nuevaSeccion[0].id_seccion, criterio.nombre, criterio.descripcion, posicionCriterio + 1],
      );
      for (const [posicionPregunta, pregunta] of criterio.preguntas.entries()) {
        await db.query(
          `INSERT INTO preguntas_evaluacion (id_criterio, id_escala, texto, peso_porcentual, es_obligatoria, orden)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            nuevoCriterio[0].id_criterio,
            pregunta.id_escala,
            pregunta.texto,
            pregunta.peso_porcentual,
            pregunta.es_obligatoria,
            posicionPregunta + 1,
          ],
        );
      }
    }
  }
}

async function ultimoNumero(idPlantilla, db = pool) {
  const { rows } = await db.query(
    `SELECT COALESCE(max(numero_version), 0)::int AS numero FROM versiones_plantilla WHERE id_plantilla = $1`,
    [idPlantilla],
  );
  return rows[0].numero;
}

async function crearBorrador(idPlantilla, numeroVersion, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO versiones_plantilla (id_plantilla, id_estado_version, numero_version)
     VALUES ($1, $2, $3) RETURNING id_version`,
    [idPlantilla, ESTADO_VERSION.BORRADOR, numeroVersion],
  );
  return rows[0].id_version;
}

// Copia la estructura completa (secciones, criterios y preguntas) de una versión a otra, con identificadores nuevos.
async function copiarEstructura(idVersionOrigen, idVersionDestino, db = pool) {
  await db.query(
    `WITH s AS (
       SELECT id_seccion AS anterior, gen_random_uuid() AS nuevo, id_competencia, orden
       FROM secciones_plantilla WHERE id_version = $1
     ), nuevas_secciones AS (
       INSERT INTO secciones_plantilla (id_seccion, id_version, id_competencia, orden)
       SELECT nuevo, $2, id_competencia, orden FROM s
     ), c AS (
       SELECT cr.id_criterio AS anterior, gen_random_uuid() AS nuevo, s.nuevo AS id_seccion, cr.nombre, cr.descripcion, cr.orden
       FROM criterios_evaluacion cr JOIN s ON s.anterior = cr.id_seccion
     ), nuevos_criterios AS (
       INSERT INTO criterios_evaluacion (id_criterio, id_seccion, nombre, descripcion, orden)
       SELECT nuevo, id_seccion, nombre, descripcion, orden FROM c
     )
     INSERT INTO preguntas_evaluacion (id_criterio, id_escala, texto, peso_porcentual, es_obligatoria, orden)
     SELECT c.nuevo, p.id_escala, p.texto, p.peso_porcentual, p.es_obligatoria, p.orden
     FROM preguntas_evaluacion p JOIN c ON c.anterior = p.id_criterio`,
    [idVersionOrigen, idVersionDestino],
  );
}

// Publica la versión y archiva la que estaba publicada, para que la plantilla tenga una sola vigente.
async function publicar(idPlantilla, idVersion, idPublicador, db = pool) {
  await db.query(
    `UPDATE versiones_plantilla SET id_estado_version = $3 WHERE id_plantilla = $1 AND id_estado_version = $2`,
    [idPlantilla, ESTADO_VERSION.PUBLICADA, ESTADO_VERSION.ARCHIVADA],
  );
  await db.query(
    `UPDATE versiones_plantilla
        SET id_estado_version = $2, id_empleado_publicador = $3, publicada_en = CURRENT_TIMESTAMP
      WHERE id_version = $1`,
    [idVersion, ESTADO_VERSION.PUBLICADA, idPublicador],
  );
}

async function tocarPlantilla(idPlantilla, db = pool) {
  await db.query(`UPDATE plantillas_evaluacion SET actualizado_en = CURRENT_TIMESTAMP WHERE id_plantilla = $1`, [idPlantilla]);
}

module.exports = {
  hoy,
  obtener,
  listarSecciones,
  listarCriterios,
  listarPreguntas,
  escalasExistentes,
  listarCompetencias,
  reemplazarSecciones,
  reemplazarEstructura,
  ultimoNumero,
  crearBorrador,
  copiarEstructura,
  publicar,
  tocarPlantilla,
};
