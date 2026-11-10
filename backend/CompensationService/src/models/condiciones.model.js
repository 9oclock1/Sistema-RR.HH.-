const pool = require("../config/db");
const { CON_VIGENCIA } = require("./conceptos.model");

// $1 = fecha de referencia: valor vigente del concepto y asignaciones vigentes ese día.
const CON_CONCEPTO = `
  SELECT x.*, ce.id_condicion, ce.tipo_condicion, ce.minutos_nocturnos_minimos,
         (SELECT COUNT(*) FROM asignaciones_condicion a
          WHERE a.id_condicion = ce.id_condicion
            AND a.vigente_desde <= $1 AND (a.vigente_hasta IS NULL OR a.vigente_hasta >= $1))::int
           AS asignaciones_vigentes
  FROM (${CON_VIGENCIA}) x
  JOIN condiciones_especiales ce ON ce.id_concepto = x.id_concepto`;

async function listar(fecha) {
  const { rows } = await pool.query(`${CON_CONCEPTO} ORDER BY x.codigo`, [fecha]);
  return rows;
}

async function obtener(id, fecha) {
  const { rows } = await pool.query(`${CON_CONCEPTO} WHERE ce.id_condicion = $2`, [fecha, id]);
  return rows[0];
}

async function crear(cliente, idConcepto, { tipo_condicion, minutos_nocturnos_minimos }) {
  const { rows } = await cliente.query(
    `INSERT INTO condiciones_especiales (id_concepto, tipo_condicion, minutos_nocturnos_minimos)
     VALUES ($1, $2, $3) RETURNING id_condicion`,
    [idConcepto, tipo_condicion, minutos_nocturnos_minimos]
  );
  return rows[0].id_condicion;
}

async function actualizarMinutos(cliente, id, minutos) {
  await cliente.query("UPDATE condiciones_especiales SET minutos_nocturnos_minimos = $1 WHERE id_condicion = $2", [
    minutos,
    id,
  ]);
}

// Condiciones activas con las vigencias de su concepto que tocan el rango.
async function activasConVigencias(desde, hasta) {
  const { rows } = await pool.query(
    `SELECT ce.id_condicion, ce.tipo_condicion, ce.minutos_nocturnos_minimos, c.codigo, c.forma_calculo,
            COALESCE(
              json_agg(json_build_object('id_vigencia', v.id_vigencia, 'valor', v.valor,
                                         'vigente_desde', v.vigente_desde, 'vigente_hasta', v.vigente_hasta)
                       ORDER BY v.vigente_desde)
                FILTER (WHERE v.id_vigencia IS NOT NULL),
              '[]'
            ) AS vigencias
     FROM condiciones_especiales ce
     JOIN conceptos_planilla c ON c.id_concepto = ce.id_concepto
     LEFT JOIN vigencias_concepto v
       ON v.id_concepto = c.id_concepto AND v.vigente_desde <= $2 AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= $1)
     WHERE c.esta_activo
     GROUP BY ce.id_condicion, c.id_concepto`,
    [desde, hasta]
  );
  return rows;
}

async function asignacionesEnRango(desde, hasta) {
  const { rows } = await pool.query(
    `SELECT id_asignacion, id_condicion, id_empleado, nombre_empleado, vigente_desde, vigente_hasta
     FROM asignaciones_condicion
     WHERE vigente_desde <= $2 AND (vigente_hasta IS NULL OR vigente_hasta >= $1)`,
    [desde, hasta]
  );
  return rows;
}

// El candado evita dos procesos del mismo mes a la vez; re-adquirirlo en la misma transacción no bloquea.
async function adquirirCandadoPeriodo(cliente, periodo) {
  await cliente.query("SELECT pg_advisory_xact_lock(hashtext('procesos_condicion:' || $1))", [periodo]);
}

// Reprocesar un mes reemplaza sus bonos.
async function reemplazarProceso(cliente, { periodo, desde, hasta, jornadas }) {
  await adquirirCandadoPeriodo(cliente, periodo);
  await cliente.query("DELETE FROM procesos_condicion WHERE periodo = $1", [periodo]);
  const { rows } = await cliente.query(
    `INSERT INTO procesos_condicion (periodo, fecha_inicio, fecha_fin, jornadas_analizadas)
     VALUES ($1, $2, $3, $4) RETURNING id_proceso`,
    [periodo, desde, hasta, jornadas]
  );
  return rows[0].id_proceso;
}

async function guardarBonos(cliente, idProceso, bonos) {
  for (const b of bonos) {
    await cliente.query(
      `INSERT INTO bonos_condicion (id_proceso, id_condicion, id_vigencia, id_empleado, nombre_empleado, origen,
                                    id_asignacion, cantidad, fechas, factor, valor, monto)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date[], $10, $11, $12)`,
      [
        idProceso,
        b.id_condicion,
        b.id_vigencia,
        b.id_empleado,
        b.nombre_empleado,
        b.origen,
        b.id_asignacion,
        b.cantidad,
        b.fechas,
        b.factor,
        b.valor,
        b.monto,
      ]
    );
  }
}

// db: pool por defecto; dentro de una transacción (p. ej. para leer el proceso anterior antes de reemplazarlo)
// se pasa el cliente de esa transacción.
async function obtenerProceso(periodo, db = pool) {
  const { rows } = await db.query(
    `SELECT id_proceso, periodo, fecha_inicio, fecha_fin, jornadas_analizadas, procesado_en
     FROM procesos_condicion WHERE periodo = $1`,
    [periodo]
  );
  return rows[0];
}

async function listarBonos(idProceso, db = pool) {
  const { rows } = await db.query(
    `SELECT b.id_bono, b.id_condicion, b.id_vigencia, b.id_empleado, b.nombre_empleado, b.origen, b.id_asignacion,
            b.cantidad, to_json(b.fechas) AS fechas, b.factor, b.valor, b.monto,
            ce.tipo_condicion, c.codigo, c.nombre, c.forma_calculo, c.base_calculo,
            c.cuenta_contable_codigo, c.cuenta_contable_nombre,
            a.vigente_desde AS asignacion_desde, a.vigente_hasta AS asignacion_hasta, a.area AS asignacion_area
     FROM bonos_condicion b
     JOIN condiciones_especiales ce ON ce.id_condicion = b.id_condicion
     JOIN conceptos_planilla c ON c.id_concepto = ce.id_concepto
     LEFT JOIN asignaciones_condicion a ON a.id_asignacion = b.id_asignacion
     WHERE b.id_proceso = $1
     ORDER BY b.nombre_empleado, c.codigo, b.fechas[1] NULLS LAST`,
    [idProceso]
  );
  return rows;
}

const COLUMNAS_ASIGNACION = `id_asignacion, id_condicion, id_empleado, nombre_empleado, area,
  vigente_desde, vigente_hasta, motivo, creado_en`;

// Primero las vigentes o programadas (las que no terminaron antes de `hoy`).
async function listarAsignaciones(idCondicion, hoy) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_ASIGNACION} FROM asignaciones_condicion
     WHERE id_condicion = $1
     ORDER BY (vigente_hasta IS NULL OR vigente_hasta >= $2) DESC, nombre_empleado, vigente_desde DESC`,
    [idCondicion, hoy]
  );
  return rows;
}

async function obtenerAsignacion(idCondicion, idAsignacion) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_ASIGNACION} FROM asignaciones_condicion WHERE id_condicion = $1 AND id_asignacion = $2`,
    [idCondicion, idAsignacion]
  );
  return rows[0];
}

// Asignaciones de esos colaboradores que se cruzan con las fechas pedidas (sin contar `excluir`).
async function asignacionesQueSeCruzan(db, idCondicion, ids, desde, hasta, excluir = null) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS_ASIGNACION} FROM asignaciones_condicion
     WHERE id_condicion = $1 AND id_empleado = ANY($2::uuid[])
       AND daterange(vigente_desde, vigente_hasta, '[]') && daterange($3::date, $4::date, '[]')
       AND ($5::uuid IS NULL OR id_asignacion <> $5)
     ORDER BY nombre_empleado`,
    [idCondicion, ids, desde, hasta, excluir]
  );
  return rows;
}

async function crearAsignacion(cliente, idCondicion, a) {
  const { rows } = await cliente.query(
    `INSERT INTO asignaciones_condicion (id_condicion, id_empleado, nombre_empleado, area, vigente_desde, vigente_hasta, motivo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNAS_ASIGNACION}`,
    [idCondicion, a.id_empleado, a.nombre_empleado, a.area, a.vigente_desde, a.vigente_hasta, a.motivo]
  );
  return rows[0];
}

async function cambiarFinAsignacion(idAsignacion, hasta) {
  const { rows } = await pool.query(
    `UPDATE asignaciones_condicion SET vigente_hasta = $1, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_asignacion = $2 RETURNING ${COLUMNAS_ASIGNACION}`,
    [hasta, idAsignacion]
  );
  return rows[0];
}

async function eliminarAsignacion(idAsignacion) {
  const { rowCount } = await pool.query("DELETE FROM asignaciones_condicion WHERE id_asignacion = $1", [idAsignacion]);
  return rowCount;
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizarMinutos,
  listarAsignaciones,
  obtenerAsignacion,
  asignacionesQueSeCruzan,
  crearAsignacion,
  cambiarFinAsignacion,
  eliminarAsignacion,
  activasConVigencias,
  asignacionesEnRango,
  adquirirCandadoPeriodo,
  reemplazarProceso,
  guardarBonos,
  obtenerProceso,
  listarBonos,
};
