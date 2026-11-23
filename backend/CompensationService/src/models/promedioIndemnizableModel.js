const pool = require("../config/db");

async function listarUltimasPlanillasCerradas(idEmpleado, periodoLimite, limite = 3) {
  const { rows } = await pool.query(
    `SELECT pe.id_planilla_empleado,
            pe.id_planilla,
            p.periodo,
            pe.dias_pagados,
            pe.haber_mensual,
            pe.total_ganado
       FROM PLANILLA_EMPLEADOS pe
       JOIN PLANILLAS p ON p.id_planilla = pe.id_planilla
      WHERE pe.id_empleado = $1
        AND p.estado = 'CERRADA'
        AND p.periodo <= $2
      ORDER BY p.periodo DESC
      LIMIT $3`,
    [idEmpleado, periodoLimite, limite]
  );
  return rows;
}

async function bloquearProceso(cliente, idProceso) {
  const { rows } = await cliente.query(
    `SELECT id_proceso, estado
       FROM PROCESOS_DESVINCULACION
      WHERE id_proceso = $1
      FOR UPDATE`,
    [idProceso]
  );
  return rows[0] || null;
}

async function guardarPromedio(cliente, idProceso, resultado, calculadoPor = {}) {
  await cliente.query(
    `INSERT INTO PROMEDIOS_INDEMNIZABLES (
       id_proceso, periodo_limite, meses_considerados, total_considerado,
       promedio, observaciones, calculado_por, calculado_por_rol
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id_proceso) DO UPDATE
     SET periodo_limite = EXCLUDED.periodo_limite,
         meses_considerados = EXCLUDED.meses_considerados,
         total_considerado = EXCLUDED.total_considerado,
         promedio = EXCLUDED.promedio,
         observaciones = EXCLUDED.observaciones,
         calculado_por = EXCLUDED.calculado_por,
         calculado_por_rol = EXCLUDED.calculado_por_rol,
         calculado_en = CURRENT_TIMESTAMP`,
    [
      idProceso,
      resultado.periodo_limite,
      resultado.meses_considerados,
      resultado.total_considerado,
      resultado.promedio,
      resultado.observaciones,
      calculadoPor.calculado_por ?? null,
      calculadoPor.calculado_por_rol ?? null,
    ]
  );

  await cliente.query(`DELETE FROM DETALLE_PROMEDIO_INDEMNIZABLE WHERE id_proceso = $1`, [idProceso]);

  for (const mes of resultado.meses) {
    await cliente.query(
      `INSERT INTO DETALLE_PROMEDIO_INDEMNIZABLE (
         id_proceso, periodo, id_planilla, id_planilla_empleado,
         dias_pagados, haber_mensual, total_ganado
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        idProceso,
        mes.periodo,
        mes.id_planilla,
        mes.id_planilla_empleado,
        mes.dias_pagados,
        mes.haber_mensual,
        mes.total_ganado,
      ]
    );
  }
}

async function marcarEnCurso(cliente, idProceso) {
  await cliente.query(
    `UPDATE PROCESOS_DESVINCULACION
        SET estado = 'EN_CURSO',
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_proceso = $1
        AND estado = 'INICIADO'`,
    [idProceso]
  );
}

async function obtenerDesglose(idProceso, db = pool) {
  const { rows: cabeceras } = await db.query(
    `SELECT pi.id_proceso,
            pr.id_empleado,
            pr.nombre_empleado,
            pr.fecha_retiro,
            pr.estado AS estado_proceso,
            pi.periodo_limite,
            pi.meses_considerados,
            pi.total_considerado,
            pi.promedio,
            pi.observaciones,
            pi.calculado_por,
            pi.calculado_en
       FROM PROMEDIOS_INDEMNIZABLES pi
       JOIN PROCESOS_DESVINCULACION pr ON pr.id_proceso = pi.id_proceso
      WHERE pi.id_proceso = $1`,
    [idProceso]
  );

  const cabecera = cabeceras[0];
  if (!cabecera) return null;

  const { rows: detalle } = await db.query(
    `SELECT periodo,
            id_planilla,
            id_planilla_empleado,
            dias_pagados,
            haber_mensual,
            total_ganado
       FROM DETALLE_PROMEDIO_INDEMNIZABLE
      WHERE id_proceso = $1
      ORDER BY periodo ASC`,
    [idProceso]
  );

  const idsPlanillaEmpleado = detalle.map((d) => d.id_planilla_empleado);
  const ingresosPorEmpleado = new Map();

  if (idsPlanillaEmpleado.length > 0) {
    const { rows: ingresos } = await db.query(
      `SELECT id_planilla_empleado,
              codigo,
              nombre,
              resultado
         FROM CALCULOS_PLANILLA
        WHERE id_planilla_empleado = ANY($1)
          AND tipo = 'INGRESO'
        ORDER BY orden ASC`,
      [idsPlanillaEmpleado]
    );

    for (const ing of ingresos) {
      if (!ingresosPorEmpleado.has(ing.id_planilla_empleado)) {
        ingresosPorEmpleado.set(ing.id_planilla_empleado, []);
      }
      ingresosPorEmpleado.get(ing.id_planilla_empleado).push({
        codigo: ing.codigo,
        nombre: ing.nombre,
        resultado: ing.resultado,
      });
    }
  }

  return {
    id_proceso: cabecera.id_proceso,
    id_empleado: cabecera.id_empleado,
    nombre_empleado: cabecera.nombre_empleado,
    fecha_retiro: cabecera.fecha_retiro,
    estado_proceso: cabecera.estado_proceso,
    periodo_limite: cabecera.periodo_limite,
    meses_considerados: cabecera.meses_considerados,
    total_considerado: cabecera.total_considerado,
    promedio: cabecera.promedio,
    observaciones: cabecera.observaciones,
    calculado_por: cabecera.calculado_por,
    calculado_en: cabecera.calculado_en,
    meses: detalle.map((m) => ({
      periodo: m.periodo,
      id_planilla: m.id_planilla,
      dias_pagados: m.dias_pagados,
      haber_mensual: m.haber_mensual,
      total_ganado: m.total_ganado,
      ingresos: ingresosPorEmpleado.get(m.id_planilla_empleado) ?? [],
    })),
  };
}

module.exports = {
  listarUltimasPlanillasCerradas,
  bloquearProceso,
  guardarPromedio,
  marcarEnCurso,
  obtenerDesglose,
};
