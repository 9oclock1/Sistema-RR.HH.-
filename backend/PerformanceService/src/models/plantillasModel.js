const pool = require("../config/db");
const { ESTADO_VERSION } = require("../utils/plantillas");

async function asegurarDepartamento(
  { id_departamento: id, nombre },
  db = pool,
) {
  await db.query(
    `INSERT INTO departamentos (id_departamento, nombre) VALUES ($1, $2)
     ON CONFLICT (id_departamento) DO UPDATE SET nombre = EXCLUDED.nombre, actualizado_en = CURRENT_TIMESTAMP`,
    [id, nombre],
  );
}

async function asegurarEmpleado(
  { id_empleado: id, nombres, apellidos },
  db = pool,
) {
  await db.query(
    `INSERT INTO empleados (id_empleado, nombres, apellidos) VALUES ($1, $2, $3)
     ON CONFLICT (id_empleado) DO UPDATE
       SET nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos, actualizado_en = CURRENT_TIMESTAMP`,
    [id, nombres, apellidos],
  );
}

const SELECT_PLANTILLA = `
  SELECT p.id_plantilla, p.nombre, p.objetivo, p.vigencia_desde, p.vigencia_hasta,
         p.creado_en, p.actualizado_en,
         d.id_departamento, d.nombre AS departamento,
         em.id_empleado AS id_creador, trim(em.nombres || ' ' || em.apellidos) AS creador,
         v.id_version, v.numero_version, v.id_estado_version, ev.codigo AS estado_codigo, ev.nombre AS estado_nombre,
         EXISTS (SELECT 1 FROM versiones_plantilla x WHERE x.id_plantilla = p.id_plantilla AND x.publicada_en IS NOT NULL) AS fue_publicada,
         (SELECT count(*)::int FROM secciones_plantilla s WHERE s.id_version = v.id_version) AS secciones_total
  FROM plantillas_evaluacion p
  JOIN departamentos d ON d.id_departamento = p.id_departamento_destino
  JOIN empleados em ON em.id_empleado = p.id_empleado_creador
  JOIN LATERAL (
    SELECT * FROM versiones_plantilla x WHERE x.id_plantilla = p.id_plantilla ORDER BY x.numero_version DESC LIMIT 1
  ) v ON TRUE
  JOIN catalogos_estado_version ev ON ev.id_estado_version = v.id_estado_version`;

async function listar({ estados, idDepartamento, busqueda }, db = pool) {
  const { rows } = await db.query(
    `${SELECT_PLANTILLA}
     WHERE ($1::smallint[] IS NULL OR v.id_estado_version = ANY($1))
       AND ($2::uuid IS NULL OR p.id_departamento_destino = $2)
       AND ($3::text IS NULL OR p.nombre ILIKE '%' || $3 || '%')
     ORDER BY p.actualizado_en DESC, p.nombre`,
    [estados, idDepartamento, busqueda],
  );
  return rows;
}

async function obtener(idPlantilla, { bloquear = false } = {}, db = pool) {
  const { rows } = await db.query(
    `${SELECT_PLANTILLA} WHERE p.id_plantilla = $1${bloquear ? " FOR UPDATE OF p" : ""}`,
    [idPlantilla],
  );
  return rows[0] ?? null;
}

async function listarVersiones(idPlantilla, db = pool) {
  const { rows } = await db.query(
    `SELECT v.id_version, v.numero_version, ev.codigo AS estado_codigo, ev.nombre AS estado_nombre,
            v.publicada_en, v.creado_en,
            trim(em.nombres || ' ' || em.apellidos) AS publicador
     FROM versiones_plantilla v
     JOIN catalogos_estado_version ev ON ev.id_estado_version = v.id_estado_version
     LEFT JOIN empleados em ON em.id_empleado = v.id_empleado_publicador
     WHERE v.id_plantilla = $1
     ORDER BY v.numero_version DESC`,
    [idPlantilla],
  );
  return rows;
}

async function buscarDuplicada(
  { nombre, idDepartamento, vigenciaDesde, vigenciaHasta, excepto = null },
  db = pool,
) {
  const { rows } = await db.query(
    `SELECT id_plantilla, nombre, vigencia_desde, vigencia_hasta
     FROM plantillas_evaluacion
     WHERE lower(btrim(nombre)) = lower(btrim($1))
       AND id_departamento_destino = $2
       AND daterange(vigencia_desde, vigencia_hasta, '[]') && daterange($3::date, $4::date, '[]')
       AND ($5::uuid IS NULL OR id_plantilla <> $5)
     LIMIT 1`,
    [nombre, idDepartamento, vigenciaDesde, vigenciaHasta, excepto],
  );
  return rows[0] ?? null;
}

async function crear(
  { nombre, objetivo, idDepartamento, vigenciaDesde, vigenciaHasta, idCreador },
  db = pool,
) {
  const { rows } = await db.query(
    `INSERT INTO plantillas_evaluacion
       (id_departamento_destino, id_empleado_creador, nombre, objetivo, vigencia_desde, vigencia_hasta)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id_plantilla`,
    [idDepartamento, idCreador, nombre, objetivo, vigenciaDesde, vigenciaHasta],
  );
  const idPlantilla = rows[0].id_plantilla;
  await db.query(
    `INSERT INTO versiones_plantilla (id_plantilla, id_estado_version, numero_version) VALUES ($1, $2, 1)`,
    [idPlantilla, ESTADO_VERSION.BORRADOR],
  );
  return idPlantilla;
}

async function actualizar(
  idPlantilla,
  { nombre, objetivo, idDepartamento, vigenciaDesde, vigenciaHasta },
  db = pool,
) {
  await db.query(
    `UPDATE plantillas_evaluacion
        SET nombre = $2, objetivo = $3, id_departamento_destino = $4,
            vigencia_desde = $5, vigencia_hasta = $6, actualizado_en = CURRENT_TIMESTAMP
      WHERE id_plantilla = $1`,
    [
      idPlantilla,
      nombre,
      objetivo,
      idDepartamento,
      vigenciaDesde,
      vigenciaHasta,
    ],
  );
}

async function eliminar(idPlantilla, db = pool) {
  const versiones = `SELECT id_version FROM versiones_plantilla WHERE id_plantilla = $1`;
  await db.query(
    `DELETE FROM preguntas_evaluacion WHERE id_criterio IN (
       SELECT c.id_criterio FROM criterios_evaluacion c
       JOIN secciones_plantilla s ON s.id_seccion = c.id_seccion
       WHERE s.id_version IN (${versiones}))`,
    [idPlantilla],
  );
  await db.query(
    `DELETE FROM criterios_evaluacion WHERE id_seccion IN (
       SELECT id_seccion FROM secciones_plantilla WHERE id_version IN (${versiones}))`,
    [idPlantilla],
  );
  await db.query(`DELETE FROM secciones_plantilla WHERE id_version IN (${versiones})`, [idPlantilla]);
  await db.query(`DELETE FROM versiones_plantilla WHERE id_plantilla = $1`, [
    idPlantilla,
  ]);
  await db.query(`DELETE FROM plantillas_evaluacion WHERE id_plantilla = $1`, [
    idPlantilla,
  ]);
}

module.exports = {
  asegurarDepartamento,
  asegurarEmpleado,
  listar,
  obtener,
  listarVersiones,
  buscarDuplicada,
  crear,
  actualizar,
  eliminar,
};
