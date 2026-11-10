const pool = require("../config/db");
const { ESTADO_EVALUACION, ESTADO_CICLO } = require("../utils/evaluaciones");
const { MODULO_EXTERNO } = require("../utils/ciclos");
const { TIPO_EVENTO_METRICAS_CRM } = require("./procesoCiclosModel");

// Ciclos cerrados: los únicos que se pueden consolidar, con cuántas evaluaciones se enviaron y cuántas vencieron.
async function listarCiclosCerrados(db = pool) {
  const { rows } = await db.query(
    `SELECT c.id_ciclo, c.nombre, c.fecha_inicio, c.fecha_limite, c.cerrado_en, c.umbral_brecha,
            pe.id_periodo, pe.nombre AS periodo,
            count(e.id_evaluacion)::int AS evaluaciones,
            (count(e.id_evaluacion) FILTER (WHERE e.id_estado_evaluacion = ${ESTADO_EVALUACION.ENVIADA}))::int AS enviadas,
            (count(e.id_evaluacion) FILTER (WHERE e.id_estado_evaluacion = ${ESTADO_EVALUACION.VENCIDA}))::int AS vencidas
     FROM ciclos_evaluacion c
     JOIN periodos_evaluacion pe ON pe.id_periodo = c.id_periodo
     LEFT JOIN evaluaciones e ON e.id_ciclo = c.id_ciclo
     WHERE c.id_estado_ciclo = ${ESTADO_CICLO.CERRADO}
     GROUP BY c.id_ciclo, pe.id_periodo
     ORDER BY c.cerrado_en DESC, c.nombre`,
  );
  return rows;
}

async function obtenerCiclo(idCiclo, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id_ciclo, c.nombre, c.id_estado_ciclo, c.fecha_inicio, c.fecha_limite, c.cerrado_en, c.umbral_brecha,
            pe.id_periodo, pe.nombre AS periodo
     FROM ciclos_evaluacion c
     JOIN periodos_evaluacion pe ON pe.id_periodo = c.id_periodo
     WHERE c.id_ciclo = $1`,
    [idCiclo],
  );
  return rows[0] ?? null;
}

// Todas las evaluaciones del ciclo con el área y la sucursal del evaluado EN ESE CICLO (no las actuales).
async function listarEvaluacionesDelCiclo(idCiclo, db = pool) {
  const { rows } = await db.query(
    `SELECT e.id_evaluacion, e.id_empleado_evaluado AS id_empleado, em.nombres, em.apellidos,
            e.id_departamento, d.nombre AS departamento, e.id_sucursal, s.nombre AS sucursal,
            e.id_estado_evaluacion, e.puntaje_final
     FROM evaluaciones e
     JOIN empleados em ON em.id_empleado = e.id_empleado_evaluado
     JOIN departamentos d ON d.id_departamento = e.id_departamento
     JOIN sucursales s ON s.id_sucursal = e.id_sucursal
     WHERE e.id_ciclo = $1
     ORDER BY em.apellidos, em.nombres, e.id_evaluacion`,
    [idCiclo],
  );
  return rows;
}

async function listarMetricasCrm(idCiclo, db = pool) {
  const { rows } = await db.query(
    `SELECT id_empleado, cantidad_quejas, cantidad_felicitaciones, minutos_resolucion_promedio
     FROM metricas_crm WHERE id_ciclo = $1`,
    [idCiclo],
  );
  return rows;
}

// Estado de la solicitud de métricas que el cierre dejó para el CRM (null si el ciclo no tiene ninguna).
async function obtenerSolicitudCrm(idCiclo, db = pool) {
  const { rows } = await db.query(
    `SELECT ev.id_evento, ce.codigo AS estado, ev.intentos, ev.ultimo_error, ev.entregado_en, ev.creado_en
     FROM eventos_salientes ev
     JOIN catalogos_estado_evento ce ON ce.id_estado_evento = ev.id_estado_evento
     WHERE ev.id_ciclo = $1 AND ev.id_modulo_destino = ${MODULO_EXTERNO.CRM} AND ev.tipo_evento = $2`,
    [idCiclo, TIPO_EVENTO_METRICAS_CRM],
  );
  return rows[0] ?? null;
}

async function actualizarUmbral(idCiclo, umbral, db = pool) {
  const { rows } = await db.query(
    `UPDATE ciclos_evaluacion SET umbral_brecha = $2, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_ciclo = $1 RETURNING id_ciclo, umbral_brecha`,
    [idCiclo, umbral],
  );
  return rows[0] ?? null;
}

module.exports = {
  listarCiclosCerrados,
  obtenerCiclo,
  listarEvaluacionesDelCiclo,
  listarMetricasCrm,
  obtenerSolicitudCrm,
  actualizarUmbral,
};
