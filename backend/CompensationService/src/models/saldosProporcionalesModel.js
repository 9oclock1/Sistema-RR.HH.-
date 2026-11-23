const pool = require("../config/db");

// Aguinaldo del colaborador ya liquidado (planilla de aguinaldos aprobada o cerrada, no excluido) en esa gestión.
async function aguinaldoLiquidado(idEmpleado, gestion, db = pool) {
  const { rows } = await db.query(
    `SELECT a.gestion, a.estado, e.monto
       FROM PLANILLA_AGUINALDO a
       JOIN AGUINALDO_EMPLEADOS e ON e.id_aguinaldo = a.id_aguinaldo
      WHERE a.gestion = $2
        AND a.estado IN ('APROBADA', 'CERRADA')
        AND e.id_empleado = $1
        AND NOT e.excluido
        AND e.monto > 0`,
    [idEmpleado, gestion]
  );
  return rows[0] || null;
}

async function guardar(cliente, idProceso, r, calculadoPor) {
  const { aguinaldo: a, vacaciones: v } = r;
  await cliente.query(
    `INSERT INTO SALDOS_PROPORCIONALES (
       id_proceso, promedio, salario_diario,
       gestion_aguinaldo, aguinaldo_desde, aguinaldo_hasta, aguinaldo_meses, aguinaldo_dias, monto_aguinaldo,
       anios_servicio, dias_acumulados, dias_gozados, dias_pendientes, monto_vacaciones_pendientes,
       anio_en_curso_desde, anio_en_curso_meses, anio_en_curso_dias, dias_escala, dias_duodecima,
       monto_duodecima_vacaciones, total, observaciones, calculado_por
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
     ON CONFLICT (id_proceso) DO UPDATE SET
       promedio = EXCLUDED.promedio,
       salario_diario = EXCLUDED.salario_diario,
       gestion_aguinaldo = EXCLUDED.gestion_aguinaldo,
       aguinaldo_desde = EXCLUDED.aguinaldo_desde,
       aguinaldo_hasta = EXCLUDED.aguinaldo_hasta,
       aguinaldo_meses = EXCLUDED.aguinaldo_meses,
       aguinaldo_dias = EXCLUDED.aguinaldo_dias,
       monto_aguinaldo = EXCLUDED.monto_aguinaldo,
       anios_servicio = EXCLUDED.anios_servicio,
       dias_acumulados = EXCLUDED.dias_acumulados,
       dias_gozados = EXCLUDED.dias_gozados,
       dias_pendientes = EXCLUDED.dias_pendientes,
       monto_vacaciones_pendientes = EXCLUDED.monto_vacaciones_pendientes,
       anio_en_curso_desde = EXCLUDED.anio_en_curso_desde,
       anio_en_curso_meses = EXCLUDED.anio_en_curso_meses,
       anio_en_curso_dias = EXCLUDED.anio_en_curso_dias,
       dias_escala = EXCLUDED.dias_escala,
       dias_duodecima = EXCLUDED.dias_duodecima,
       monto_duodecima_vacaciones = EXCLUDED.monto_duodecima_vacaciones,
       total = EXCLUDED.total,
       observaciones = EXCLUDED.observaciones,
       calculado_por = EXCLUDED.calculado_por,
       calculado_en = CURRENT_TIMESTAMP`,
    [
      idProceso, r.promedio, r.salario_diario,
      a.gestion, a.desde, a.hasta, a.meses, a.dias, a.monto,
      v.anios_servicio, v.dias_acumulados, v.dias_gozados, v.dias_pendientes, v.monto_pendientes,
      v.anio_en_curso.desde, v.anio_en_curso.meses, v.anio_en_curso.dias, v.dias_escala, v.dias_duodecima,
      v.monto_duodecima, r.total, r.observaciones, calculadoPor,
    ]
  );
}

async function obtener(idProceso, db = pool) {
  const { rows } = await db.query(
    `SELECT s.*,
            to_char(s.aguinaldo_desde, 'YYYY-MM-DD') AS aguinaldo_desde,
            to_char(s.aguinaldo_hasta, 'YYYY-MM-DD') AS aguinaldo_hasta,
            to_char(s.anio_en_curso_desde, 'YYYY-MM-DD') AS anio_en_curso_desde,
            pr.nombre_empleado, to_char(pr.fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro, pr.estado AS estado_proceso
       FROM SALDOS_PROPORCIONALES s
       JOIN PROCESOS_DESVINCULACION pr ON pr.id_proceso = s.id_proceso
      WHERE s.id_proceso = $1`,
    [idProceso]
  );
  const s = rows[0];
  if (!s) return null;
  return {
    id_proceso: s.id_proceso,
    nombre_empleado: s.nombre_empleado,
    fecha_retiro: s.fecha_retiro,
    estado_proceso: s.estado_proceso,
    promedio: s.promedio,
    salario_diario: s.salario_diario,
    aguinaldo: {
      gestion: s.gestion_aguinaldo,
      desde: s.aguinaldo_desde,
      hasta: s.aguinaldo_hasta,
      meses: s.aguinaldo_meses,
      dias: s.aguinaldo_dias,
      monto: s.monto_aguinaldo,
    },
    vacaciones: {
      anios_servicio: s.anios_servicio,
      dias_acumulados: s.dias_acumulados,
      dias_gozados: s.dias_gozados,
      dias_pendientes: s.dias_pendientes,
      monto_pendientes: s.monto_vacaciones_pendientes,
      anio_en_curso: { desde: s.anio_en_curso_desde, hasta: s.fecha_retiro, meses: s.anio_en_curso_meses, dias: s.anio_en_curso_dias },
      dias_escala: s.dias_escala,
      dias_duodecima: s.dias_duodecima,
      monto_duodecima: s.monto_duodecima_vacaciones,
    },
    total: s.total,
    observaciones: s.observaciones,
    calculado_por: s.calculado_por,
    calculado_en: s.calculado_en,
  };
}

module.exports = { aguinaldoLiquidado, guardar, obtener };
