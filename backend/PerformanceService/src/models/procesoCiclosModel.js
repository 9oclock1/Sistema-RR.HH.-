const pool = require("../config/db");
const { ESTADO_EVALUACION, ESTADO_CICLO } = require("../utils/evaluaciones");
const { MODULO_EXTERNO } = require("../utils/catalogos");

const TIPO_EVENTO_METRICAS_CRM = "SOLICITUD_METRICAS_CRM";
const ABIERTAS = `${ESTADO_EVALUACION.PENDIENTE}, ${ESTADO_EVALUACION.BORRADOR}`;

// Los ciclos programados cuya fecha de inicio llegó pasan a activos.
async function activarCiclos(hoy, db = pool) {
  const { rows } = await db.query(
    `UPDATE ciclos_evaluacion
     SET id_estado_ciclo = ${ESTADO_CICLO.ACTIVO}, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_estado_ciclo = ${ESTADO_CICLO.PROGRAMADO} AND fecha_inicio <= $1::date
     RETURNING id_ciclo, nombre`,
    [hoy],
  );
  return rows;
}

// Evaluaciones abiertas de ciclos activos a los que les faltan `dias` días o menos y que aún no se recordaron.
async function listarRecordatoriosPendientes(hoy, dias, db = pool) {
  const { rows } = await db.query(
    `SELECT e.id_evaluacion, e.id_empleado_evaluador,
            c.id_ciclo, c.nombre AS ciclo, c.fecha_limite, c.id_empleado_creador,
            (c.fecha_limite - $1::date)::int AS dias_restantes,
            em.nombres, em.apellidos
     FROM evaluaciones e
     JOIN ciclos_evaluacion c ON c.id_ciclo = e.id_ciclo
     JOIN empleados em ON em.id_empleado = e.id_empleado_evaluado
     WHERE c.id_estado_ciclo = ${ESTADO_CICLO.ACTIVO}
       AND e.id_estado_evaluacion IN (${ABIERTAS})
       AND e.recordatorio_enviado_en IS NULL
       AND c.fecha_limite BETWEEN $1::date AND ($1::date + $2::int)
     ORDER BY c.fecha_limite, e.id_empleado_evaluador, em.apellidos, em.nombres`,
    [hoy, dias],
  );
  return rows;
}

// Solo se marca lo que sigue abierto y sin recordar, así un reintento nunca pisa una evaluación que ya se envió.
async function marcarRecordatorios(idsEvaluaciones, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE evaluaciones SET recordatorio_enviado_en = CURRENT_TIMESTAMP
     WHERE id_evaluacion = ANY($1::uuid[])
       AND recordatorio_enviado_en IS NULL
       AND id_estado_evaluacion IN (${ABIERTAS})`,
    [idsEvaluaciones],
  );
  return rowCount;
}

// Ciclos activos cuya fecha límite ya pasó (el último día del plazo todavía se puede responder).
async function listarCiclosVencidos(hoy, db = pool) {
  const { rows } = await db.query(
    `SELECT id_ciclo, nombre FROM ciclos_evaluacion
     WHERE id_estado_ciclo = ${ESTADO_CICLO.ACTIVO} AND fecha_limite < $1::date
     ORDER BY fecha_limite, nombre`,
    [hoy],
  );
  return rows;
}

// Cierra el ciclo, vence sus evaluaciones abiertas y registra la solicitud de métricas para el CRM (outbox).
// Devuelve null si otro proceso ya lo cerró. Debe correr dentro de una transacción.
async function cerrarCiclo(db, idCiclo) {
  const { rows } = await db.query(
    `UPDATE ciclos_evaluacion
     SET id_estado_ciclo = ${ESTADO_CICLO.CERRADO}, cerrado_en = CURRENT_TIMESTAMP, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_ciclo = $1 AND id_estado_ciclo = ${ESTADO_CICLO.ACTIVO}
     RETURNING id_ciclo, nombre, id_periodo, fecha_inicio, fecha_limite, cerrado_en`,
    [idCiclo],
  );
  const ciclo = rows[0];
  if (!ciclo) return null;

  const vencidas = await db.query(
    `UPDATE evaluaciones
     SET id_estado_evaluacion = ${ESTADO_EVALUACION.VENCIDA}, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_ciclo = $1 AND id_estado_evaluacion IN (${ABIERTAS})`,
    [idCiclo],
  );

  const { rows: evaluados } = await db.query(
    "SELECT DISTINCT id_empleado_evaluado FROM evaluaciones WHERE id_ciclo = $1 ORDER BY id_empleado_evaluado",
    [idCiclo],
  );
  const carga = {
    id_ciclo: ciclo.id_ciclo,
    nombre: ciclo.nombre,
    fecha_inicio: ciclo.fecha_inicio,
    fecha_limite: ciclo.fecha_limite,
    cerrado_en: ciclo.cerrado_en,
    empleados: evaluados.map((fila) => fila.id_empleado_evaluado),
  };
  await db.query(
    `INSERT INTO eventos_salientes (id_ciclo, id_modulo_destino, tipo_evento, carga)
     VALUES ($1, ${MODULO_EXTERNO.CRM}, '${TIPO_EVENTO_METRICAS_CRM}', $2::jsonb)
     ON CONFLICT ON CONSTRAINT uq_evento_ciclo_destino_tipo DO NOTHING`,
    [idCiclo, JSON.stringify(carga)],
  );

  return { id_ciclo: ciclo.id_ciclo, nombre: ciclo.nombre, evaluaciones_vencidas: vencidas.rowCount };
}

module.exports = {
  TIPO_EVENTO_METRICAS_CRM,
  activarCiclos,
  listarRecordatoriosPendientes,
  marcarRecordatorios,
  listarCiclosVencidos,
  cerrarCiclo,
};
