const pool = require("../config/db");
const { ESTADO_EVALUACION, ESTADO_CICLO } = require("../utils/evaluaciones");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

const ESTADO_EFECTIVO = `
  CASE WHEN e.id_estado_evaluacion IN (${ESTADO_EVALUACION.PENDIENTE}, ${ESTADO_EVALUACION.BORRADOR})
        AND (c.fecha_limite < ${HOY_BOLIVIA} OR c.id_estado_ciclo = ${ESTADO_CICLO.CERRADO})
       THEN ${ESTADO_EVALUACION.VENCIDA}
       ELSE e.id_estado_evaluacion END`;

async function hoy(db = pool) {
  const { rows } = await db.query(`SELECT ${HOY_BOLIVIA} AS hoy`);
  return rows[0].hoy;
}

async function listarBandeja({ idEvaluador, idCiclo, estados }, db = pool) {
  const { rows } = await db.query(
    `SELECT b.*, ce.codigo AS estado_codigo, ce.nombre AS estado_nombre
     FROM (
       SELECT e.id_evaluacion, e.id_empleado_evaluado, em.nombres, em.apellidos, su.nombre AS sucursal,
              c.id_ciclo, c.nombre AS ciclo, c.fecha_limite,
              ${ESTADO_EFECTIVO} AS id_estado,
              e.puntaje_final, e.enviada_en, e.actualizado_en,
              (SELECT count(*)::int FROM preguntas_evaluacion p
                 JOIN criterios_evaluacion cr USING (id_criterio)
                 JOIN secciones_plantilla s USING (id_seccion)
                WHERE s.id_version = c.id_version) AS total,
              (SELECT count(*)::int FROM respuestas_evaluacion r WHERE r.id_evaluacion = e.id_evaluacion) AS respondidas,
              (SELECT count(*)::int FROM preguntas_evaluacion p
                 JOIN criterios_evaluacion cr USING (id_criterio)
                 JOIN secciones_plantilla s USING (id_seccion)
                WHERE s.id_version = c.id_version AND p.es_obligatoria) AS obligatorias_total,
              (SELECT count(*)::int FROM respuestas_evaluacion r
                 JOIN preguntas_evaluacion p USING (id_pregunta)
                WHERE r.id_evaluacion = e.id_evaluacion AND p.es_obligatoria) AS obligatorias_respondidas
       FROM evaluaciones e
       JOIN ciclos_evaluacion c ON c.id_ciclo = e.id_ciclo
       JOIN empleados em ON em.id_empleado = e.id_empleado_evaluado
       JOIN sucursales su ON su.id_sucursal = e.id_sucursal
       WHERE e.id_empleado_evaluador = $1
         AND c.id_estado_ciclo <> ${ESTADO_CICLO.PROGRAMADO}
         AND ($2::uuid IS NULL OR c.id_ciclo = $2)
     ) b
     JOIN catalogos_estado_evaluacion ce ON ce.id_estado_evaluacion = b.id_estado
     WHERE $3::smallint[] IS NULL OR b.id_estado = ANY($3)
     ORDER BY b.fecha_limite, b.apellidos, b.nombres`,
    [idEvaluador, idCiclo, estados],
  );
  return rows;
}

// Ciclos en los que el evaluador tiene evaluaciones: opciones del filtro de la bandeja.
async function listarCiclos(idEvaluador, db = pool) {
  const { rows } = await db.query(
    `SELECT DISTINCT c.id_ciclo, c.nombre, c.fecha_limite, ce.codigo AS estado_codigo, ce.nombre AS estado_nombre
     FROM evaluaciones e
     JOIN ciclos_evaluacion c ON c.id_ciclo = e.id_ciclo
     JOIN catalogos_estado_ciclo ce ON ce.id_estado_ciclo = c.id_estado_ciclo
     WHERE e.id_empleado_evaluador = $1 AND c.id_estado_ciclo <> ${ESTADO_CICLO.PROGRAMADO}
     ORDER BY c.fecha_limite DESC, c.nombre`,
    [idEvaluador],
  );
  return rows;
}

// Con bloquear = true toma la fila de la evaluación (FOR UPDATE) hasta el fin de la transacción, de modo que un autoguardado y el envío final no se pisen entre sí.
async function obtenerEvaluacion(
  idEvaluacion,
  { bloquear = false } = {},
  db = pool,
) {
  const { rows } = await db.query(
    `SELECT e.id_evaluacion, e.id_empleado_evaluado, e.id_empleado_evaluador, e.id_estado_evaluacion,
            e.puntaje_final, e.enviada_en, e.actualizado_en,
            c.id_ciclo, c.id_version, c.nombre AS ciclo, c.fecha_limite, c.id_estado_ciclo,
            ${HOY_BOLIVIA} AS hoy,
            em.nombres, em.apellidos, su.nombre AS sucursal, de.nombre AS departamento,
            pl.nombre AS plantilla, pl.objetivo, v.numero_version
     FROM evaluaciones e
     JOIN ciclos_evaluacion c ON c.id_ciclo = e.id_ciclo
     JOIN empleados em ON em.id_empleado = e.id_empleado_evaluado
     JOIN sucursales su ON su.id_sucursal = e.id_sucursal
     JOIN departamentos de ON de.id_departamento = e.id_departamento
     JOIN versiones_plantilla v ON v.id_version = c.id_version
     JOIN plantillas_evaluacion pl ON pl.id_plantilla = v.id_plantilla
     WHERE e.id_evaluacion = $1
     ${bloquear ? "FOR UPDATE OF e" : ""}`,
    [idEvaluacion],
  );
  return rows[0] ?? null;
}

async function listarEstructura(idVersion, idEvaluacion, db = pool) {
  const { rows } = await db.query(
    `SELECT s.id_seccion, s.orden AS orden_seccion,
            co.id_competencia, co.nombre AS competencia, co.descripcion AS competencia_descripcion, tc.codigo AS tipo_competencia,
            cr.id_criterio, cr.nombre AS criterio, cr.descripcion AS criterio_descripcion, cr.orden AS orden_criterio,
            p.id_pregunta, p.texto, p.peso_porcentual, p.es_obligatoria, p.orden AS orden_pregunta,
            esc.id_escala, esc.nombre AS escala, te.codigo AS tipo_escala,
            r.id_nivel AS id_nivel_respondido, nr.valor AS valor_respondido
     FROM secciones_plantilla s
     JOIN competencias co ON co.id_competencia = s.id_competencia
     JOIN catalogos_tipo_competencia tc ON tc.id_tipo_competencia = co.id_tipo_competencia
     JOIN criterios_evaluacion cr ON cr.id_seccion = s.id_seccion
     JOIN preguntas_evaluacion p ON p.id_criterio = cr.id_criterio
     JOIN escalas_valoracion esc ON esc.id_escala = p.id_escala
     JOIN catalogos_tipo_escala te ON te.id_tipo_escala = esc.id_tipo_escala
     LEFT JOIN respuestas_evaluacion r ON r.id_pregunta = p.id_pregunta AND r.id_evaluacion = $2
     LEFT JOIN niveles_escala nr ON nr.id_nivel = r.id_nivel
     WHERE s.id_version = $1
     ORDER BY s.orden, cr.orden, p.orden`,
    [idVersion, idEvaluacion],
  );
  return rows;
}

async function listarNiveles(idsEscala, db = pool) {
  if (idsEscala.length === 0) return [];
  const { rows } = await db.query(
    "SELECT id_nivel, id_escala, valor, etiqueta FROM niveles_escala WHERE id_escala = ANY($1::uuid[]) ORDER BY id_escala, valor",
    [idsEscala],
  );
  return rows;
}

async function guardarRespuestas(idEvaluacion, respuestas, db = pool) {
  if (respuestas.length === 0) return;
  await db.query(
    `INSERT INTO respuestas_evaluacion (id_evaluacion, id_pregunta, id_nivel)
     SELECT $1::uuid, t.id_pregunta, t.id_nivel
     FROM unnest($2::uuid[], $3::uuid[]) AS t (id_pregunta, id_nivel)
     ON CONFLICT ON CONSTRAINT uq_respuesta_evaluacion_pregunta
     DO UPDATE SET id_nivel = EXCLUDED.id_nivel, actualizado_en = CURRENT_TIMESTAMP`,
    [
      idEvaluacion,
      respuestas.map((r) => r.idPregunta),
      respuestas.map((r) => r.idNivel),
    ],
  );
}

async function borrarRespuestas(idEvaluacion, idsPregunta, db = pool) {
  if (idsPregunta.length === 0) return;
  await db.query(
    "DELETE FROM respuestas_evaluacion WHERE id_evaluacion = $1 AND id_pregunta = ANY($2::uuid[])",
    [idEvaluacion, idsPregunta],
  );
}

async function contarRespuestas(idEvaluacion, db = pool) {
  const { rows } = await db.query(
    "SELECT count(*)::int AS cantidad FROM respuestas_evaluacion WHERE id_evaluacion = $1",
    [idEvaluacion],
  );
  return rows[0].cantidad;
}

// Solo cambia el estado de evaluaciones abiertas, una enviada nunca vuelve atrás.
async function cambiarEstadoAbierta(idEvaluacion, idEstado, db = pool) {
  const { rows } = await db.query(
    `UPDATE evaluaciones SET id_estado_evaluacion = $2, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_evaluacion = $1 AND id_estado_evaluacion IN (${ESTADO_EVALUACION.PENDIENTE}, ${ESTADO_EVALUACION.BORRADOR})
     RETURNING actualizado_en`,
    [idEvaluacion, idEstado],
  );
  return rows[0]?.actualizado_en ?? null;
}

// Congela el puntaje y bloquea la evaluación. Devuelve null si ya no estaba abierta.
async function marcarEnviada(idEvaluacion, puntaje, db = pool) {
  const { rows } = await db.query(
    `UPDATE evaluaciones
     SET id_estado_evaluacion = ${ESTADO_EVALUACION.ENVIADA}, puntaje_final = $2,
         enviada_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_evaluacion = $1 AND id_estado_evaluacion IN (${ESTADO_EVALUACION.PENDIENTE}, ${ESTADO_EVALUACION.BORRADOR})
     RETURNING enviada_en`,
    [idEvaluacion, puntaje],
  );
  return rows[0]?.enviada_en ?? null;
}

module.exports = {
  hoy,
  listarBandeja,
  listarCiclos,
  obtenerEvaluacion,
  listarEstructura,
  listarNiveles,
  guardarRespuestas,
  borrarRespuestas,
  contarRespuestas,
  cambiarEstadoAbierta,
  marcarEnviada,
};
