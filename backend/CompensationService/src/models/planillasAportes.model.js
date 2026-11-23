const CAMPOS_DETALLE = [
  "id_empleado",
  "nombre_empleado",
  "numero_documento",
  "codigo_entidad",
  "tipo",
  "codigo_concepto",
  "nombre_concepto",
  "id_vigencia",
  "base",
  "tasa",
  "monto",
];

async function listarEntidades(db) {
  const { rows } = await db.query("SELECT codigo, nombre, formato_archivo, orden FROM entidades_aporte ORDER BY orden");
  return rows;
}

async function listarRenglones(db, idPlanilla) {
  const { rows } = await db.query(
    `SELECT pe.id_empleado, pe.nombre_empleado, pe.numero_documento, k.tipo, k.codigo, k.nombre, k.id_vigencia,
            k.base, k.valor, k.resultado, ce.codigo_entidad
     FROM planilla_empleados pe
     JOIN calculos_planilla k ON k.id_planilla_empleado = pe.id_planilla_empleado AND k.tipo IN ('DESCUENTO', 'APORTE')
     JOIN conceptos_planilla co ON co.codigo = k.codigo
     LEFT JOIN conceptos_entidad_aporte ce ON ce.codigo_concepto = k.codigo
     WHERE pe.id_planilla = $1 AND (ce.codigo_concepto IS NOT NULL OR co.es_de_ley)
     ORDER BY pe.nombre_empleado, k.orden`,
    [idPlanilla]
  );
  return rows;
}

async function reemplazar(cliente, { planilla, totales, advertencias, responsable, detalles }) {
  await cliente.query("DELETE FROM planillas_aportes WHERE id_planilla = $1", [planilla.id_planilla]);
  const { rows } = await cliente.query(
    `INSERT INTO planillas_aportes (id_planilla, periodo, cantidad_empleados, total_laboral, total_patronal, advertencias,
                                    generada_por, generada_por_nombre)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id_planilla_aportes`,
    [
      planilla.id_planilla,
      planilla.periodo,
      totales.cantidad_empleados,
      totales.total_laboral,
      totales.total_patronal,
      advertencias,
      responsable.id,
      responsable.nombre,
    ]
  );
  const idPlanillaAportes = rows[0].id_planilla_aportes;
  for (const detalle of detalles) {
    await cliente.query(
      `INSERT INTO detalle_aportes (id_planilla_aportes, ${CAMPOS_DETALLE.join(", ")})
       VALUES ($1, ${CAMPOS_DETALLE.map((_, i) => `$${i + 2}`).join(", ")})`,
      [idPlanillaAportes, ...CAMPOS_DETALLE.map((campo) => detalle[campo])]
    );
  }
  return idPlanillaAportes;
}

async function obtenerGuardada(db, idPlanilla) {
  const { rows } = await db.query("SELECT * FROM planillas_aportes WHERE id_planilla = $1", [idPlanilla]);
  if (!rows[0]) return null;
  const { rows: detalles } = await db.query(
    `SELECT ${CAMPOS_DETALLE.join(", ")} FROM detalle_aportes
     WHERE id_planilla_aportes = $1 ORDER BY nombre_empleado, tipo DESC, codigo_concepto`,
    [rows[0].id_planilla_aportes]
  );
  return { cabecera: rows[0], detalles };
}

module.exports = { listarEntidades, listarRenglones, reemplazar, obtenerGuardada };
