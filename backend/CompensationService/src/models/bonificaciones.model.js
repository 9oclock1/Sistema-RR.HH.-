const pool = require("../config/db");

async function registrarCambios(cliente, filas) {
  for (const f of filas) {
    await cliente.query(
      `INSERT INTO auditoria_bonificaciones
         (tipo_bono, id_condicion, id_asignacion, periodo, id_empleado, nombre_empleado, accion,
          valor_anterior, valor_nuevo, monto_anterior, monto_nuevo, factor_anterior, factor_nuevo,
          realizado_por, realizado_por_rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
      [
        f.tipo_bono,
        f.id_condicion,
        f.id_asignacion,
        f.periodo,
        f.id_empleado,
        f.nombre_empleado,
        f.accion,
        f.valor_anterior,
        f.valor_nuevo,
        f.monto_anterior,
        f.monto_nuevo,
        f.factor_anterior,
        f.factor_nuevo,
        f.realizado_por,
        f.realizado_por_rol,
      ]
    );
  }
}

// Historial de bonos de un colaborador a través de todos los periodos ya procesados (RF-53, criterio 1):
// bonos_condicion no se borra entre periodos, solo el del periodo que se reprocesa (ver reemplazarProceso).
async function historialPorEmpleado(idEmpleado, { periodo, tipoCondicion } = {}) {
  const { rows } = await pool.query(
    `SELECT b.id_bono, p.periodo, b.id_condicion, ce.tipo_condicion, c.codigo, c.nombre,
            c.cuenta_contable_codigo, c.cuenta_contable_nombre,
            b.origen, b.cantidad, to_json(b.fechas) AS fechas, b.factor, b.valor, b.monto,
            b.id_asignacion, a.area AS asignacion_area
     FROM bonos_condicion b
     JOIN procesos_condicion p ON p.id_proceso = b.id_proceso
     JOIN condiciones_especiales ce ON ce.id_condicion = b.id_condicion
     JOIN conceptos_planilla c ON c.id_concepto = ce.id_concepto
     LEFT JOIN asignaciones_condicion a ON a.id_asignacion = b.id_asignacion
     WHERE b.id_empleado = $1
       AND ($2::char(7) IS NULL OR p.periodo = $2)
       AND ($3::varchar IS NULL OR ce.tipo_condicion = $3)
     ORDER BY p.periodo DESC, c.codigo`,
    [idEmpleado, periodo, tipoCondicion]
  );
  return rows;
}

const LIMITE_AUDITORIA = 500;

// Auditoría de cambios (RF-53, criterio 2): quién, cuándo y el valor anterior. id_empleado es opcional para
// que el Auditor pueda revisar un periodo completo sin elegir colaborador primero.
async function listarAuditoria({ idEmpleado, periodo, tipoBono }) {
  const { rows } = await pool.query(
    `SELECT id_auditoria, tipo_bono, id_condicion, id_asignacion, periodo, id_empleado, nombre_empleado, accion,
            valor_anterior, valor_nuevo, monto_anterior, monto_nuevo, factor_anterior, factor_nuevo,
            realizado_por, realizado_por_rol, realizado_en
     FROM auditoria_bonificaciones
     WHERE ($1::uuid IS NULL OR id_empleado = $1)
       AND ($2::char(7) IS NULL OR periodo = $2)
       AND ($3::varchar IS NULL OR tipo_bono = $3)
     ORDER BY realizado_en DESC
     LIMIT ${LIMITE_AUDITORIA}`,
    [idEmpleado, periodo, tipoBono]
  );
  return rows;
}

module.exports = { registrarCambios, historialPorEmpleado, listarAuditoria };
