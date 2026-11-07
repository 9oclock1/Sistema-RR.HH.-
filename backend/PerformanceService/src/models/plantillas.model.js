const pool = require("../config/db");
const { ESTADO_VERSION } = require("../utils/catalogos");

// Las funciones que escriben reciben el cliente de la transacción en curso.
// Estructura: PLANTILLAS_EVALUACION (datos base) -> VERSIONES_PLANTILLA -> SECCIONES_PLANTILLA (una competencia)
// -> CRITERIOS_EVALUACION -> PREGUNTAS_EVALUACION (cada una con su escala del catálogo).

const PREGUNTAS_DE_VERSION = `
  FROM preguntas_evaluacion q
  JOIN criterios_evaluacion c ON c.id_criterio = q.id_criterio
  JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion`;

// Una fila por versión, con el resumen de su estructura.
async function listar() {
  const { rows } = await pool.query(
    `SELECT v.id_version, v.id_plantilla, v.numero_version, ev.codigo AS estado, v.publicada_en,
            p.nombre, p.vigencia_desde, p.vigencia_hasta, p.id_departamento_destino, d.nombre AS departamento,
            (SELECT count(*)::int FROM secciones_plantilla s WHERE s.id_version = v.id_version) AS total_secciones,
            (SELECT count(*)::int FROM criterios_evaluacion c
               JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion
              WHERE s.id_version = v.id_version) AS total_criterios,
            (SELECT count(*)::int ${PREGUNTAS_DE_VERSION} WHERE s.id_version = v.id_version) AS total_preguntas,
            (SELECT COALESCE(sum(q.peso_porcentual), 0) ${PREGUNTAS_DE_VERSION} WHERE s.id_version = v.id_version) AS suma_pesos
     FROM versiones_plantilla v
     JOIN plantillas_evaluacion p ON p.id_plantilla = v.id_plantilla
     JOIN departamentos d ON d.id_departamento = p.id_departamento_destino
     JOIN catalogos_estado_version ev ON ev.id_estado_version = v.id_estado_version
     ORDER BY p.nombre, d.nombre, v.numero_version DESC`
  );
  return rows;
}

// Con bloquear = true toma la versión y su plantilla (FOR UPDATE) hasta el fin de la transacción.
async function obtenerVersion(idVersion, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT v.id_version, v.id_plantilla, v.numero_version, v.id_estado_version, ev.codigo AS estado,
            v.publicada_en, v.id_empleado_publicador,
            NULLIF(concat_ws(' ', pu.nombres, pu.apellidos), '') AS publicador,
            p.nombre, p.objetivo, p.id_departamento_destino, d.nombre AS departamento,
            p.vigencia_desde, p.vigencia_hasta, p.id_empleado_creador,
            EXISTS (SELECT 1 FROM versiones_plantilla o
                     WHERE o.id_plantilla = p.id_plantilla
                       AND o.id_estado_version <> ${ESTADO_VERSION.BORRADOR}) AS tiene_publicadas
     FROM versiones_plantilla v
     JOIN plantillas_evaluacion p ON p.id_plantilla = v.id_plantilla
     JOIN departamentos d ON d.id_departamento = p.id_departamento_destino
     JOIN catalogos_estado_version ev ON ev.id_estado_version = v.id_estado_version
     LEFT JOIN empleados pu ON pu.id_empleado = v.id_empleado_publicador
     WHERE v.id_version = $1
     ${bloquear ? "FOR UPDATE OF v, p" : ""}`,
    [idVersion]
  );
  return rows[0];
}

// Secciones con su competencia, criterios y preguntas, en orden.
// Las consultas van una tras otra: db puede ser el cliente de una transacción, que no admite consultas en paralelo.
async function obtenerEstructura(idVersion, db = pool) {
  const secciones = await db.query(
    `SELECT s.id_seccion, s.id_competencia, co.nombre AS competencia, tc.codigo AS tipo_competencia
     FROM secciones_plantilla s
     JOIN competencias co ON co.id_competencia = s.id_competencia
     JOIN catalogos_tipo_competencia tc ON tc.id_tipo_competencia = co.id_tipo_competencia
     WHERE s.id_version = $1 ORDER BY s.orden`,
    [idVersion]
  );
  const criterios = await db.query(
    `SELECT c.id_criterio, c.id_seccion, c.nombre, c.descripcion
     FROM criterios_evaluacion c JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion
     WHERE s.id_version = $1 ORDER BY c.orden`,
    [idVersion]
  );
  const preguntas = await db.query(
    `SELECT q.id_pregunta, q.id_criterio, q.texto, q.peso_porcentual, q.es_obligatoria, q.id_escala
     ${PREGUNTAS_DE_VERSION}
     WHERE s.id_version = $1 ORDER BY q.orden`,
    [idVersion]
  );

  return secciones.rows.map((seccion) => ({
    ...seccion,
    criterios: criterios.rows
      .filter((criterio) => criterio.id_seccion === seccion.id_seccion)
      .map(({ id_seccion, ...criterio }) => ({
        ...criterio,
        preguntas: preguntas.rows
          .filter((pregunta) => pregunta.id_criterio === criterio.id_criterio)
          .map(({ id_criterio, ...pregunta }) => pregunta),
      })),
  }));
}

// Réplicas mínimas de EmployeeDB: se crean o actualizan antes de usarlas. id_usuario no se toca.
async function replicarEmpleado(db, { id_empleado, nombres, apellidos }) {
  await db.query(
    `INSERT INTO empleados (id_empleado, nombres, apellidos) VALUES ($1, $2, $3)
     ON CONFLICT (id_empleado) DO UPDATE
       SET nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos, actualizado_en = CURRENT_TIMESTAMP`,
    [id_empleado, nombres, apellidos]
  );
}

async function replicarDepartamento(db, { id_departamento, nombre }) {
  await db.query(
    `INSERT INTO departamentos (id_departamento, nombre) VALUES ($1, $2)
     ON CONFLICT (id_departamento) DO UPDATE SET nombre = EXCLUDED.nombre, actualizado_en = CURRENT_TIMESTAMP`,
    [id_departamento, nombre]
  );
}

async function crearPlantilla(db, datos, idCreador) {
  const { rows } = await db.query(
    `INSERT INTO plantillas_evaluacion
       (id_departamento_destino, id_empleado_creador, nombre, objetivo, vigencia_desde, vigencia_hasta)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_plantilla`,
    [datos.id_departamento_destino, idCreador, datos.nombre, datos.objetivo, datos.vigencia_desde, datos.vigencia_hasta]
  );
  return rows[0].id_plantilla;
}

async function actualizarPlantilla(db, idPlantilla, datos) {
  await db.query(
    `UPDATE plantillas_evaluacion
     SET id_departamento_destino = $1, nombre = $2, objetivo = $3, vigencia_desde = $4, vigencia_hasta = $5,
         actualizado_en = CURRENT_TIMESTAMP
     WHERE id_plantilla = $6`,
    [datos.id_departamento_destino, datos.nombre, datos.objetivo, datos.vigencia_desde, datos.vigencia_hasta, idPlantilla]
  );
}

async function crearVersion(db, idPlantilla, numeroVersion = 1) {
  const { rows } = await db.query(
    `INSERT INTO versiones_plantilla (id_plantilla, numero_version) VALUES ($1, $2) RETURNING id_version`,
    [idPlantilla, numeroVersion]
  );
  return rows[0].id_version;
}

async function borrarEstructura(db, idVersion) {
  await db.query(
    `DELETE FROM preguntas_evaluacion q USING criterios_evaluacion c, secciones_plantilla s
     WHERE q.id_criterio = c.id_criterio AND c.id_seccion = s.id_seccion AND s.id_version = $1`,
    [idVersion]
  );
  await db.query(
    `DELETE FROM criterios_evaluacion c USING secciones_plantilla s
     WHERE c.id_seccion = s.id_seccion AND s.id_version = $1`,
    [idVersion]
  );
  await db.query("DELETE FROM secciones_plantilla WHERE id_version = $1", [idVersion]);
}

// Reemplaza toda la estructura: el borrador se guarda como un documento completo.
async function reemplazarEstructura(db, idVersion, secciones) {
  await borrarEstructura(db, idVersion);
  for (const [ordenSeccion, seccion] of secciones.entries()) {
    const { rows } = await db.query(
      `INSERT INTO secciones_plantilla (id_version, id_competencia, orden) VALUES ($1, $2, $3) RETURNING id_seccion`,
      [idVersion, seccion.id_competencia, ordenSeccion + 1]
    );
    const { id_seccion: idSeccion } = rows[0];
    for (const [ordenCriterio, criterio] of seccion.criterios.entries()) {
      const insertado = await db.query(
        `INSERT INTO criterios_evaluacion (id_seccion, nombre, descripcion, orden)
         VALUES ($1, $2, $3, $4) RETURNING id_criterio`,
        [idSeccion, criterio.nombre, criterio.descripcion, ordenCriterio + 1]
      );
      const preguntas = criterio.preguntas;
      if (preguntas.length === 0) continue;
      await db.query(
        `INSERT INTO preguntas_evaluacion (id_criterio, id_escala, texto, peso_porcentual, es_obligatoria, orden)
         SELECT $1::uuid, * FROM UNNEST($2::uuid[], $3::text[], $4::numeric[], $5::boolean[], $6::smallint[])`,
        [
          insertado.rows[0].id_criterio,
          preguntas.map((p) => p.id_escala),
          preguntas.map((p) => p.texto),
          preguntas.map((p) => p.peso_porcentual),
          preguntas.map((p) => p.es_obligatoria),
          preguntas.map((_, indice) => indice + 1),
        ]
      );
    }
  }
}

async function obtenerBorrador(db, idPlantilla) {
  const { rows } = await db.query(
    `SELECT id_version FROM versiones_plantilla WHERE id_plantilla = $1 AND id_estado_version = $2`,
    [idPlantilla, ESTADO_VERSION.BORRADOR]
  );
  return rows[0];
}

async function siguienteNumero(db, idPlantilla) {
  const { rows } = await db.query(
    "SELECT max(numero_version)::int + 1 AS numero FROM versiones_plantilla WHERE id_plantilla = $1",
    [idPlantilla]
  );
  return rows[0].numero;
}

// La versión publicada reemplaza a la anterior, que queda archivada para los ciclos que ya la usan.
async function publicar(db, idVersion, idPlantilla, idPublicador) {
  await db.query(
    `UPDATE versiones_plantilla SET id_estado_version = $1
     WHERE id_plantilla = $2 AND id_estado_version = $3`,
    [ESTADO_VERSION.ARCHIVADA, idPlantilla, ESTADO_VERSION.PUBLICADA]
  );
  await db.query(
    `UPDATE versiones_plantilla
     SET id_estado_version = $1, id_empleado_publicador = $2, publicada_en = CURRENT_TIMESTAMP
     WHERE id_version = $3`,
    [ESTADO_VERSION.PUBLICADA, idPublicador, idVersion]
  );
}

// Elimina un borrador; si era la única versión, también los datos base de la plantilla.
async function eliminarVersion(db, idVersion, idPlantilla) {
  await borrarEstructura(db, idVersion);
  await db.query("DELETE FROM versiones_plantilla WHERE id_version = $1", [idVersion]);
  await db.query(
    `DELETE FROM plantillas_evaluacion p WHERE p.id_plantilla = $1
       AND NOT EXISTS (SELECT 1 FROM versiones_plantilla v WHERE v.id_plantilla = p.id_plantilla)`,
    [idPlantilla]
  );
}

// Ids de la lista que existen en el catálogo (competencias activas o escalas).
async function competenciasActivas(db, ids) {
  const { rows } = await db.query(
    "SELECT id_competencia FROM competencias WHERE esta_activa AND id_competencia = ANY($1::uuid[])",
    [ids]
  );
  return new Set(rows.map((fila) => fila.id_competencia));
}

async function escalasExistentes(db, ids) {
  const { rows } = await db.query("SELECT id_escala FROM escalas_valoracion WHERE id_escala = ANY($1::uuid[])", [ids]);
  return new Set(rows.map((fila) => fila.id_escala));
}

module.exports = {
  listar,
  obtenerVersion,
  obtenerEstructura,
  replicarEmpleado,
  replicarDepartamento,
  crearPlantilla,
  actualizarPlantilla,
  crearVersion,
  reemplazarEstructura,
  obtenerBorrador,
  siguienteNumero,
  publicar,
  eliminarVersion,
  competenciasActivas,
  escalasExistentes,
};
