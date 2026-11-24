const pool = require("../config/db");

const CAMPOS_RETENCION = [
  "id_empleado",
  "nombre_empleado",
  "numero_documento",
  "total_ganado",
  "aportes_laborales",
  "sueldo_neto",
  "base_imponible",
  "impuesto_determinado",
  "computo_salarios_minimos",
  "monto_facturas",
  "credito_fiscal_facturas",
  "origen_saldo",
  "saldo_mes_anterior",
  "actualizacion_ufv",
  "saldo_anterior_favor",
  "credito_aplicado",
  "impuesto_retenido",
  "saldo_favor_siguiente",
];

async function obtenerPlanilla(db, idPlanilla) {
  const { rows } = await db.query("SELECT id_planilla, periodo, estado, fecha_fin FROM planillas WHERE id_planilla = $1", [idPlanilla]);
  return rows[0] ?? null;
}

async function parametrosVigentes(db, fecha) {
  const { rows } = await db.query(
    `SELECT codigo, nombre, valor FROM parametros_tributarios
     WHERE $1::date BETWEEN vigente_desde AND COALESCE(vigente_hasta, 'infinity'::date)`,
    [fecha]
  );
  return rows;
}

async function listarParametros(db = pool) {
  const { rows } = await db.query(
    `SELECT id_parametro, codigo, nombre, valor, vigente_desde, vigente_hasta,
            (CURRENT_DATE BETWEEN vigente_desde AND COALESCE(vigente_hasta, 'infinity'::date)) AS vigente
     FROM parametros_tributarios ORDER BY codigo, vigente_desde DESC`
  );
  return rows;
}

async function existeTributaria(db, periodo) {
  const { rows } = await db.query("SELECT 1 FROM planillas_tributarias WHERE periodo = $1", [periodo]);
  return rows.length > 0;
}

async function existePlanilla(db, periodo) {
  const { rows } = await db.query("SELECT 1 FROM planillas WHERE periodo = $1", [periodo]);
  return rows.length > 0;
}

async function valorUfv(db, fecha) {
  const { rows } = await db.query("SELECT valor FROM valores_ufv WHERE fecha = $1", [fecha]);
  return rows[0] ? Number(rows[0].valor) : null;
}

async function listarBasesRciva(db, idPlanilla, periodo, periodoAnterior) {
  const { rows } = await db.query(
    `SELECT pe.id_empleado, pe.nombre_empleado, pe.numero_documento, pe.total_ganado,
            COALESCE((SELECT SUM(k.resultado)
                      FROM calculos_planilla k
                      JOIN conceptos_entidad_aporte ce ON ce.codigo_concepto = k.codigo AND ce.deduce_sueldo_neto
                      WHERE k.id_planilla_empleado = pe.id_planilla_empleado AND k.tipo = 'DESCUENTO'), 0) AS aportes_laborales,
            COALESCE(cf.monto_facturas, 0) AS monto_facturas,
            COALESCE(cf.saldo_inicial_favor, 0) AS saldo_inicial_favor,
            COALESCE((SELECT r.saldo_favor_siguiente
                      FROM retenciones_rciva r
                      JOIN planillas_tributarias pt ON pt.id_planilla_tributaria = r.id_planilla_tributaria
                      WHERE pt.periodo = $3 AND r.id_empleado = pe.id_empleado), 0) AS saldo_mes_anterior
     FROM planilla_empleados pe
     LEFT JOIN creditos_fiscales_declarados cf ON cf.id_empleado = pe.id_empleado AND cf.periodo = $2
     WHERE pe.id_planilla = $1
     ORDER BY pe.nombre_empleado`,
    [idPlanilla, periodo, periodoAnterior]
  );
  return rows;
}

async function conceptosDeLeySinEntidad(db, idPlanilla) {
  const { rows } = await db.query(
    `SELECT DISTINCT k.codigo, k.nombre
     FROM planilla_empleados pe
     JOIN calculos_planilla k ON k.id_planilla_empleado = pe.id_planilla_empleado AND k.tipo = 'DESCUENTO'
     JOIN conceptos_planilla co ON co.codigo = k.codigo AND co.es_de_ley
     WHERE pe.id_planilla = $1
       AND NOT EXISTS (SELECT 1 FROM conceptos_entidad_aporte ce WHERE ce.codigo_concepto = k.codigo)
     ORDER BY k.codigo`,
    [idPlanilla]
  );
  return rows;
}

async function reemplazar(cliente, { planilla, parametros, saldoAnterior, totales, advertencias, responsable, retenciones }) {
  await cliente.query("DELETE FROM planillas_tributarias WHERE id_planilla = $1", [planilla.id_planilla]);
  const { rows } = await cliente.query(
    `INSERT INTO planillas_tributarias (
       id_planilla, periodo, salario_minimo, multiplo_minimo_no_imponible, minimo_no_imponible, alicuota_rciva,
       alicuota_credito_fiscal, computo_salarios_minimos, periodo_saldo_anterior, ufv_inicial, ufv_final,
       cantidad_dependientes, total_sueldo_neto, total_base_imponible, total_impuesto_determinado,
       total_computo_salarios_minimos, total_credito_aplicado, total_impuesto_retenido, total_actualizacion_ufv,
       advertencias, generada_por, generada_por_nombre
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
     RETURNING id_planilla_tributaria`,
    [
      planilla.id_planilla,
      planilla.periodo,
      parametros.salarioMinimo,
      parametros.multiplo,
      parametros.minimoNoImponible,
      parametros.alicuotaRciva,
      parametros.alicuotaCredito,
      parametros.computoSalariosMinimos,
      saldoAnterior.periodo,
      saldoAnterior.ufv?.inicial ?? null,
      saldoAnterior.ufv?.final ?? null,
      totales.cantidad_dependientes,
      totales.total_sueldo_neto,
      totales.total_base_imponible,
      totales.total_impuesto_determinado,
      totales.total_computo_salarios_minimos,
      totales.total_credito_aplicado,
      totales.total_impuesto_retenido,
      totales.total_actualizacion_ufv,
      advertencias,
      responsable.id,
      responsable.nombre,
    ]
  );
  const idPlanillaTributaria = rows[0].id_planilla_tributaria;
  for (const retencion of retenciones) {
    await cliente.query(
      `INSERT INTO retenciones_rciva (id_planilla_tributaria, ${CAMPOS_RETENCION.join(", ")})
       VALUES ($1, ${CAMPOS_RETENCION.map((_, i) => `$${i + 2}`).join(", ")})`,
      [idPlanillaTributaria, ...CAMPOS_RETENCION.map((campo) => retencion[campo])]
    );
  }
  return idPlanillaTributaria;
}

async function obtenerGuardada(db, idPlanilla) {
  const { rows } = await db.query("SELECT * FROM planillas_tributarias WHERE id_planilla = $1", [idPlanilla]);
  if (!rows[0]) return null;
  const { rows: retenciones } = await db.query(
    `SELECT ${CAMPOS_RETENCION.join(", ")} FROM retenciones_rciva
     WHERE id_planilla_tributaria = $1 ORDER BY nombre_empleado`,
    [rows[0].id_planilla_tributaria]
  );
  return { cabecera: rows[0], retenciones };
}

async function listarCreditos(db, periodo) {
  const { rows } = await db.query(
    `SELECT id_empleado, periodo, monto_facturas, saldo_inicial_favor, declarado_en
     FROM creditos_fiscales_declarados WHERE periodo = $1 ORDER BY id_empleado`,
    [periodo]
  );
  return rows;
}

async function guardarCredito(db, { idEmpleado, periodo, montoFacturas, saldoInicialFavor }) {
  const { rows } = await db.query(
    `INSERT INTO creditos_fiscales_declarados (id_empleado, periodo, monto_facturas, saldo_inicial_favor)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_empleado, periodo)
     DO UPDATE SET monto_facturas = EXCLUDED.monto_facturas, saldo_inicial_favor = EXCLUDED.saldo_inicial_favor,
                   declarado_en = CURRENT_TIMESTAMP
     RETURNING id_empleado, periodo, monto_facturas, saldo_inicial_favor, declarado_en`,
    [idEmpleado, periodo, montoFacturas, saldoInicialFavor]
  );
  return rows[0];
}

module.exports = {
  obtenerPlanilla,
  parametrosVigentes,
  listarParametros,
  existeTributaria,
  existePlanilla,
  valorUfv,
  listarBasesRciva,
  conceptosDeLeySinEntidad,
  reemplazar,
  obtenerGuardada,
  listarCreditos,
  guardarCredito,
};
