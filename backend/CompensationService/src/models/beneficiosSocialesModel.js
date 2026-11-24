const pool = require("../config/db");

// Bloquea el proceso y trae lo necesario para el cálculo, incluido el sueldo promedio vigente (KAN-75).
async function bloquearProceso(cliente, idProceso) {
  const { rows } = await cliente.query(
    `SELECT p.id_proceso,
            p.estado,
            p.fecha_ingreso,
            p.fecha_retiro,
            p.codigo_causal,
            c.nombre AS causal_nombre,
            p.corresponde_desahucio,
            pi.promedio
       FROM PROCESOS_DESVINCULACION p
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
       LEFT JOIN PROMEDIOS_INDEMNIZABLES pi ON pi.id_proceso = p.id_proceso
      WHERE p.id_proceso = $1
      FOR UPDATE OF p`,
    [idProceso]
  );
  return rows[0] || null;
}

async function guardar(cliente, idProceso, resultado, calculadoPor = {}) {
  await cliente.query(
    `INSERT INTO BENEFICIOS_SOCIALES (
       id_proceso, promedio_base, fecha_ingreso, fecha_retiro, dias_servicio,
       anios_servicio, meses_servicio, dias_fraccion,
       corresponde_indemnizacion, motivo_indemnizacion, monto_indemnizacion,
       corresponde_desahucio, motivo_desahucio, monto_desahucio,
       total, calculado_por, calculado_por_rol
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (id_proceso) DO UPDATE
     SET promedio_base = EXCLUDED.promedio_base,
         fecha_ingreso = EXCLUDED.fecha_ingreso,
         fecha_retiro = EXCLUDED.fecha_retiro,
         dias_servicio = EXCLUDED.dias_servicio,
         anios_servicio = EXCLUDED.anios_servicio,
         meses_servicio = EXCLUDED.meses_servicio,
         dias_fraccion = EXCLUDED.dias_fraccion,
         corresponde_indemnizacion = EXCLUDED.corresponde_indemnizacion,
         motivo_indemnizacion = EXCLUDED.motivo_indemnizacion,
         monto_indemnizacion = EXCLUDED.monto_indemnizacion,
         corresponde_desahucio = EXCLUDED.corresponde_desahucio,
         motivo_desahucio = EXCLUDED.motivo_desahucio,
         monto_desahucio = EXCLUDED.monto_desahucio,
         total = EXCLUDED.total,
         calculado_por = EXCLUDED.calculado_por,
         calculado_por_rol = EXCLUDED.calculado_por_rol,
         calculado_en = CURRENT_TIMESTAMP`,
    [
      idProceso,
      resultado.promedio_base,
      resultado.fecha_ingreso,
      resultado.fecha_retiro,
      resultado.dias_servicio,
      resultado.anios_servicio,
      resultado.meses_servicio,
      resultado.dias_fraccion,
      resultado.corresponde_indemnizacion,
      resultado.motivo_indemnizacion,
      resultado.monto_indemnizacion,
      resultado.corresponde_desahucio,
      resultado.motivo_desahucio,
      resultado.monto_desahucio,
      resultado.total,
      calculadoPor.calculado_por ?? null,
      calculadoPor.calculado_por_rol ?? null,
    ]
  );

  await cliente.query(`DELETE FROM DETALLE_BENEFICIOS_SOCIALES WHERE id_proceso = $1`, [idProceso]);

  for (const r of resultado.renglones) {
    await cliente.query(
      `INSERT INTO DETALLE_BENEFICIOS_SOCIALES (
         id_proceso, orden, codigo_concepto, descripcion, unidad, cantidad, divisor, monto
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [idProceso, r.orden, r.codigo_concepto, r.descripcion, r.unidad, r.cantidad, r.divisor, r.monto]
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
    `SELECT b.*,
            p.nombre_empleado,
            p.codigo_causal,
            c.nombre AS causal_nombre,
            p.estado AS estado_proceso,
            pi.promedio AS promedio_vigente
       FROM BENEFICIOS_SOCIALES b
       JOIN PROCESOS_DESVINCULACION p ON p.id_proceso = b.id_proceso
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
       LEFT JOIN PROMEDIOS_INDEMNIZABLES pi ON pi.id_proceso = b.id_proceso
      WHERE b.id_proceso = $1`,
    [idProceso]
  );

  const b = cabeceras[0];
  if (!b) return null;

  const { rows: renglones } = await db.query(
    `SELECT orden, codigo_concepto, descripcion, unidad, cantidad, divisor, monto
       FROM DETALLE_BENEFICIOS_SOCIALES
      WHERE id_proceso = $1
      ORDER BY orden ASC`,
    [idProceso]
  );

  return {
    id_proceso: b.id_proceso,
    nombre_empleado: b.nombre_empleado,
    causal: { codigo: b.codigo_causal, nombre: b.causal_nombre },
    estado_proceso: b.estado_proceso,
    promedio_base: b.promedio_base,
    // El sueldo promedio se recalculó después de este cálculo: hay que volver a calcular.
    desactualizado: b.promedio_vigente === null || b.promedio_vigente !== b.promedio_base,
    fecha_ingreso: b.fecha_ingreso,
    fecha_retiro: b.fecha_retiro,
    tiempo_servicio: {
      dias_servicio: b.dias_servicio,
      anios: b.anios_servicio,
      meses: b.meses_servicio,
      dias: b.dias_fraccion,
    },
    indemnizacion: {
      corresponde: b.corresponde_indemnizacion,
      motivo: b.motivo_indemnizacion,
      monto: b.monto_indemnizacion,
    },
    desahucio: {
      corresponde: b.corresponde_desahucio,
      motivo: b.motivo_desahucio,
      monto: b.monto_desahucio,
    },
    total: b.total,
    renglones,
    calculado_por: b.calculado_por,
    calculado_en: b.calculado_en,
  };
}

module.exports = { bloquearProceso, guardar, marcarEnCurso, obtenerDesglose };
