const pool = require("../config/db");

async function registrarCambios(cliente, filas) {
  for (const f of filas) {
    await cliente.query(
      `INSERT INTO auditoria_bonificaciones
         (tipo_bono, id_condicion, id_asignacion, id_regla, periodo, id_empleado, nombre_empleado, accion,
          valor_anterior, valor_nuevo, monto_anterior, monto_nuevo, factor_anterior, factor_nuevo,
          realizado_por, realizado_por_rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)`,
      [
        f.tipo_bono,
        f.id_condicion,
        f.id_asignacion,
        f.id_regla,
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

// Historial de bonos por condición de un colaborador a través de todos los periodos ya procesados (RF-53,
// criterio 1): bonos_condicion no se borra entre periodos, solo el del periodo que se reprocesa (ver
// reemplazarProceso). Un array de un solo id sirve para el historial de un colaborador.
async function historialPorEmpleados(ids, { periodo, tipoCondicion } = {}) {
  const { rows } = await pool.query(
    `SELECT b.id_bono, p.periodo, b.id_empleado, b.nombre_empleado, b.id_condicion, ce.tipo_condicion, c.codigo, c.nombre,
            c.cuenta_contable_codigo, c.cuenta_contable_nombre,
            b.origen, b.cantidad, to_json(b.fechas) AS fechas, b.factor, b.valor, b.monto,
            b.id_asignacion, a.area AS asignacion_area
     FROM bonos_condicion b
     JOIN procesos_condicion p ON p.id_proceso = b.id_proceso
     JOIN condiciones_especiales ce ON ce.id_condicion = b.id_condicion
     JOIN conceptos_planilla c ON c.id_concepto = ce.id_concepto
     LEFT JOIN asignaciones_condicion a ON a.id_asignacion = b.id_asignacion
     WHERE b.id_empleado = ANY($1::uuid[])
       AND ($2::char(7) IS NULL OR p.periodo = $2)
       AND ($3::varchar IS NULL OR ce.tipo_condicion = $3)
     ORDER BY p.periodo DESC, c.codigo`,
    [ids, periodo ?? null, tipoCondicion ?? null]
  );
  return rows;
}

const historialPorEmpleado = (idEmpleado, filtros) => historialPorEmpleados([idEmpleado], filtros);

// Historial de bonos de productividad (RF-53, criterio 1): con la regla que lo originó (tipo de meta, umbral
// y forma de cálculo) y el cumplimiento propio del bono, igual que pide la revisión del PO.
async function historialProductividadPorEmpleados(ids, { periodo } = {}) {
  const { rows } = await pool.query(
    `SELECT b.id_bono, to_char(b.periodo, 'YYYY-MM') AS periodo, b.id_empleado, b.id_regla,
            r.tipo_meta, r.umbral_cumplimiento, r.forma_calculo,
            b.porcentaje_cumplimiento, b.valor, b.monto, b.generado_en
     FROM bonos_productividad b
     JOIN reglas_bono_productividad r ON r.id_regla = b.id_regla
     WHERE b.id_empleado = ANY($1::uuid[])
       AND ($2::char(7) IS NULL OR to_char(b.periodo, 'YYYY-MM') = $2)
     ORDER BY b.periodo DESC`,
    [ids, periodo ?? null]
  );
  return rows;
}

const historialProductividadPorEmpleado = (idEmpleado, filtros) =>
  historialProductividadPorEmpleados([idEmpleado], filtros);

// Bono de antigüedad (RF-53, criterio 1; KAN-70): no se persiste por colaborador, solo queda el renglón ya
// calculado en cada planilla generada (CALCULOS_PLANILLA). Siempre de solo lectura, no tiene auditoría propia.
async function historialAntiguedadPorEmpleados(ids, { periodo } = {}) {
  const { rows } = await pool.query(
    `SELECT c.id_calculo, pl.periodo, pe.id_empleado, pe.nombre_empleado, c.base, c.cantidad, c.valor, c.resultado, c.detalle
     FROM calculos_planilla c
     JOIN planilla_empleados pe ON pe.id_planilla_empleado = c.id_planilla_empleado
     JOIN planillas pl ON pl.id_planilla = pe.id_planilla
     WHERE c.codigo = 'BONO-ANTIGUEDAD'
       AND pe.id_empleado = ANY($1::uuid[])
       AND ($2::char(7) IS NULL OR pl.periodo = $2)
     ORDER BY pl.periodo DESC`,
    [ids, periodo ?? null]
  );
  return rows;
}

const historialAntiguedadPorEmpleado = (idEmpleado, filtros) => historialAntiguedadPorEmpleados([idEmpleado], filtros);

const LIMITE_AUDITORIA = 500;

// Auditoría de cambios (RF-53, criterio 2): quién, cuándo y el valor anterior. id_empleado es opcional para
// que el Auditor pueda revisar un periodo completo sin elegir colaborador primero.
async function listarAuditoria({ idEmpleado, periodo, tipoBono }) {
  const { rows } = await pool.query(
    `SELECT id_auditoria, tipo_bono, id_condicion, id_asignacion, id_regla, periodo, id_empleado, nombre_empleado,
            accion, valor_anterior, valor_nuevo, monto_anterior, monto_nuevo, factor_anterior, factor_nuevo,
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

module.exports = {
  registrarCambios,
  historialPorEmpleado,
  historialPorEmpleados,
  historialProductividadPorEmpleado,
  historialProductividadPorEmpleados,
  historialAntiguedadPorEmpleado,
  historialAntiguedadPorEmpleados,
  listarAuditoria,
};
