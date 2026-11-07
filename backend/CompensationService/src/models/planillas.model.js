const pool = require("../config/db");

const COLUMNAS_PLANILLA = `p.id_planilla, p.periodo, p.fecha_inicio, p.fecha_fin, p.datos_hasta, p.estado, p.advertencias,
  p.generada_por, p.generada_por_nombre, p.generada_en, p.aprobada_por, p.aprobada_por_nombre, p.aprobada_en,
  p.estado_contabilidad, p.estado_pagos, p.cerrada_en,
  (SELECT COUNT(*) FROM planilla_empleados pe WHERE pe.id_planilla = p.id_planilla)::int AS colaboradores`;

const COLUMNAS_EMPLEADO = [
  "id_empleado",
  "nombre_empleado",
  "numero_documento",
  "cargo",
  "area",
  "sucursal",
  "id_contrato",
  "numero_contrato",
  "haber_mensual",
  "contrato_desde",
  "contrato_hasta",
  "dias_contrato",
  "faltas_injustificadas",
  "dias_licencia_sin_goce",
  "dias_licencia_con_goce",
  "dias_pagados",
  "atrasos",
  "minutos_atraso",
  "minutos_extra_habil",
  "minutos_extra_domingo",
  "minutos_extra_feriado",
  "minutos_extra_nocturnos",
  "minutos_domingo",
  "minutos_feriado",
  "minutos_descanso",
  "minutos_nocturnos",
  "observaciones",
];

const COLUMNAS_NOVEDAD = ["origen", "id_vigencia", "codigo", "nombre", "forma_calculo", "cantidad", "factor", "valor", "monto", "detalle"];

const marcadores = (cantidad, desde = 1) => Array.from({ length: cantidad }, (_, i) => `$${i + desde}`).join(", ");

async function listar(periodo = null) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_PLANILLA} FROM planillas p
     WHERE $1::char(7) IS NULL OR p.periodo = $1
     ORDER BY p.periodo DESC LIMIT 24`,
    [periodo]
  );
  return rows;
}

async function obtener(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS_PLANILLA} FROM planillas p WHERE p.id_planilla = $1`, [id]);
  return rows[0];
}

// Un solo proceso a la vez por mes; la fila del mes queda bloqueada hasta terminar.
async function bloquearPeriodo(cliente, periodo) {
  await cliente.query("SELECT pg_advisory_xact_lock(hashtext('planillas:' || $1))", [periodo]);
  const { rows } = await cliente.query("SELECT id_planilla, estado FROM planillas WHERE periodo = $1 FOR UPDATE", [periodo]);
  return rows[0];
}

async function bloquear(cliente, id) {
  const { rows } = await cliente.query("SELECT id_planilla, periodo, estado, datos_hasta, fecha_fin FROM planillas WHERE id_planilla = $1 FOR UPDATE", [id]);
  return rows[0];
}

async function crear(cliente, c) {
  const { rows } = await cliente.query(
    `INSERT INTO planillas (periodo, fecha_inicio, fecha_fin, datos_hasta, advertencias, generada_por, generada_por_nombre)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id_planilla`,
    [c.periodo, c.fecha_inicio, c.fecha_fin, c.datos_hasta, c.advertencias, c.generada_por, c.generada_por_nombre]
  );
  return rows[0].id_planilla;
}

// Volver a generar un borrador: misma planilla, datos nuevos. Solo cambia mientras está en borrador
// (sin triggers: cada escritura lleva la condición). Devuelve false si ya no era borrador.
async function reemplazar(cliente, id, c) {
  const { rowCount } = await cliente.query(
    `UPDATE planillas SET datos_hasta = $2, advertencias = $3, generada_por = $4, generada_por_nombre = $5,
            generada_en = CURRENT_TIMESTAMP
     WHERE id_planilla = $1 AND estado = 'BORRADOR'`,
    [id, c.datos_hasta, c.advertencias, c.generada_por, c.generada_por_nombre]
  );
  if (rowCount === 0) return false;
  await cliente.query("DELETE FROM planilla_empleados WHERE id_planilla = $1", [id]);
  return true;
}

async function guardarEmpleados(cliente, idPlanilla, empleados) {
  for (const e of empleados) {
    const { rows } = await cliente.query(
      `INSERT INTO planilla_empleados (id_planilla, ${COLUMNAS_EMPLEADO.join(", ")})
       VALUES ($1, ${marcadores(COLUMNAS_EMPLEADO.length, 2)}) RETURNING id_planilla_empleado`,
      [idPlanilla, ...COLUMNAS_EMPLEADO.map((c) => e[c])]
    );
    for (const n of e.novedades) {
      await cliente.query(
        `INSERT INTO novedades_planilla (id_planilla_empleado, ${COLUMNAS_NOVEDAD.join(", ")})
         VALUES ($1, ${marcadores(COLUMNAS_NOVEDAD.length, 2)})`,
        [rows[0].id_planilla_empleado, ...COLUMNAS_NOVEDAD.map((c) => n[c])]
      );
    }
  }
}

async function listarEmpleados(id) {
  const { rows } = await pool.query(
    `SELECT pe.id_planilla_empleado, ${COLUMNAS_EMPLEADO.map((c) => `pe.${c}`).join(", ")},
            COALESCE(
              json_agg(json_build_object(${COLUMNAS_NOVEDAD.map((c) => `'${c}', n.${c}`).join(", ")}, 'id_novedad', n.id_novedad)
                       ORDER BY n.codigo) FILTER (WHERE n.id_novedad IS NOT NULL),
              '[]'
            ) AS novedades
     FROM planilla_empleados pe
     LEFT JOIN novedades_planilla n ON n.id_planilla_empleado = pe.id_planilla_empleado
     WHERE pe.id_planilla = $1
     GROUP BY pe.id_planilla_empleado
     ORDER BY pe.nombre_empleado`,
    [id]
  );
  return rows;
}

async function eliminar(cliente, id) {
  const { rowCount } = await cliente.query("DELETE FROM planillas WHERE id_planilla = $1 AND estado = 'BORRADOR'", [id]);
  return rowCount === 1;
}

async function aprobar(cliente, id, { idEmpleado, nombre }) {
  const { rowCount } = await cliente.query(
    `UPDATE planillas SET estado = 'APROBADA', aprobada_por = $2, aprobada_por_nombre = $3, aprobada_en = CURRENT_TIMESTAMP
     WHERE id_planilla = $1 AND estado = 'BORRADOR'`,
    [id, idEmpleado, nombre]
  );
  return rowCount === 1;
}

async function contarEmpleados(cliente, id) {
  const { rows } = await cliente.query("SELECT COUNT(*)::int AS cantidad FROM planilla_empleados WHERE id_planilla = $1", [id]);
  return rows[0].cantidad;
}

module.exports = {
  listar,
  obtener,
  bloquearPeriodo,
  bloquear,
  crear,
  reemplazar,
  guardarEmpleados,
  listarEmpleados,
  eliminar,
  aprobar,
  contarEmpleados,
};
