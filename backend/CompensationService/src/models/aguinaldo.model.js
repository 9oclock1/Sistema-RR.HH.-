const pool = require("../config/db");

const COLUMNAS = `a.id_aguinaldo, a.gestion, a.fecha_inicio, a.fecha_fin, a.estado,
  a.generada_por, a.generada_por_nombre, a.generada_en, a.aprobada_por, a.aprobada_por_nombre, a.aprobada_en,
  a.estado_contabilidad, a.referencia_contabilidad, a.motivo_contabilidad, a.respondida_contabilidad_en,
  a.estado_pagos, a.referencia_pagos, a.motivo_pagos, a.respondida_pagos_en, a.cerrada_en,
  (SELECT COUNT(*) FROM aguinaldo_empleados e WHERE e.id_aguinaldo = a.id_aguinaldo)::int AS colaboradores`;

const COLUMNAS_EMPLEADO = [
  "id_empleado",
  "nombre_empleado",
  "numero_documento",
  "cargo",
  "area",
  "sucursal",
  "fecha_ingreso",
  "meses_trabajados",
  "dias_trabajados",
  "promedio_sueldo",
  "monto",
  "excluido",
  "motivo_exclusion",
];

async function listar() {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM planilla_aguinaldo a ORDER BY a.gestion DESC LIMIT 24`);
  return rows;
}

async function obtener(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS} FROM planilla_aguinaldo a WHERE a.id_aguinaldo = $1`, [id]);
  return rows[0];
}

// Un solo proceso a la vez por gestión; la fila de la gestión queda bloqueada hasta terminar.
async function bloquearGestion(cliente, gestion) {
  await cliente.query("SELECT pg_advisory_xact_lock(hashtext('aguinaldo:' || $1))", [gestion]);
  const { rows } = await cliente.query("SELECT id_aguinaldo, estado FROM planilla_aguinaldo WHERE gestion = $1 FOR UPDATE", [gestion]);
  return rows[0];
}

async function bloquear(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT id_aguinaldo, gestion, estado, estado_contabilidad, estado_pagos
     FROM planilla_aguinaldo WHERE id_aguinaldo = $1 FOR UPDATE`,
    [id]
  );
  return rows[0];
}

async function crear(cliente, c) {
  const { rows } = await cliente.query(
    `INSERT INTO planilla_aguinaldo (gestion, fecha_inicio, fecha_fin, generada_por, generada_por_nombre)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_aguinaldo`,
    [c.gestion, c.fecha_inicio, c.fecha_fin, c.generada_por, c.generada_por_nombre]
  );
  return rows[0].id_aguinaldo;
}

// Volver a generar un borrador: misma gestión, datos nuevos. Devuelve false si ya no era borrador.
async function reemplazar(cliente, id, c) {
  const { rowCount } = await cliente.query(
    `UPDATE planilla_aguinaldo SET generada_por = $2, generada_por_nombre = $3, generada_en = CURRENT_TIMESTAMP
     WHERE id_aguinaldo = $1 AND estado = 'BORRADOR'`,
    [id, c.generada_por, c.generada_por_nombre]
  );
  if (rowCount === 0) return false;
  await cliente.query("DELETE FROM aguinaldo_empleados WHERE id_aguinaldo = $1", [id]);
  return true;
}

const marcadores = (cantidad, desde = 1) => Array.from({ length: cantidad }, (_, i) => `$${i + desde}`).join(", ");

async function guardarEmpleados(cliente, idAguinaldo, empleados) {
  for (const e of empleados) {
    await cliente.query(
      `INSERT INTO aguinaldo_empleados (id_aguinaldo, ${COLUMNAS_EMPLEADO.join(", ")})
       VALUES ($1, ${marcadores(COLUMNAS_EMPLEADO.length, 2)})`,
      [idAguinaldo, ...COLUMNAS_EMPLEADO.map((c) => e[c])]
    );
  }
}

async function listarEmpleados(id) {
  const { rows } = await pool.query(
    `SELECT id_aguinaldo_empleado, ${COLUMNAS_EMPLEADO.join(", ")}
     FROM aguinaldo_empleados WHERE id_aguinaldo = $1 ORDER BY nombre_empleado`,
    [id]
  );
  return rows;
}

async function eliminar(cliente, id) {
  const { rowCount } = await cliente.query("DELETE FROM planilla_aguinaldo WHERE id_aguinaldo = $1 AND estado = 'BORRADOR'", [id]);
  return rowCount === 1;
}

async function aprobar(cliente, id, { idEmpleado, nombre }) {
  const { rowCount } = await cliente.query(
    `UPDATE planilla_aguinaldo SET estado = 'APROBADA', aprobada_por = $2, aprobada_por_nombre = $3, aprobada_en = CURRENT_TIMESTAMP
     WHERE id_aguinaldo = $1 AND estado = 'BORRADOR'`,
    [id, idEmpleado, nombre]
  );
  return rowCount === 1;
}

async function contarEmpleados(cliente, id) {
  const { rows } = await cliente.query(
    "SELECT COUNT(*)::int AS cantidad FROM aguinaldo_empleados WHERE id_aguinaldo = $1 AND NOT excluido", [id]
  );
  return rows[0].cantidad;
}

// Colaboradores no excluidos, para el asiento y la orden de dispersión.
async function empleadosDeIntegracion(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT id_empleado, nombre_empleado, numero_documento, monto
     FROM aguinaldo_empleados WHERE id_aguinaldo = $1 AND NOT excluido ORDER BY nombre_empleado`,
    [id]
  );
  return rows;
}

// Monto del aguinaldo por sucursal (centro de costo), para el reporte contable consolidado (RF-49, KAN-69).
async function montosPorCentroDeCosto(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT sucursal, area, SUM(monto) AS monto, COUNT(*)::int AS colaboradores
     FROM aguinaldo_empleados WHERE id_aguinaldo = $1 AND NOT excluido
     GROUP BY sucursal, area ORDER BY sucursal, area`,
    [id]
  );
  return rows;
}

const CAMPO_DESTINO = { CONTABILIDAD: "contabilidad", PAGOS: "pagos" };

async function responder(cliente, id, destino, { resultado, referencia, motivo }) {
  const c = CAMPO_DESTINO[destino];
  const { rowCount } = await cliente.query(
    `UPDATE planilla_aguinaldo
     SET estado_${c} = $2, referencia_${c} = $3, motivo_${c} = $4, respondida_${c}_en = CURRENT_TIMESTAMP
     WHERE id_aguinaldo = $1 AND estado = 'APROBADA' AND estado_${c} <> 'CONFIRMADA'`,
    [id, resultado, referencia, motivo]
  );
  return rowCount === 1;
}

async function cerrarSiConfirmada(cliente, id) {
  const { rowCount } = await cliente.query(
    `UPDATE planilla_aguinaldo SET estado = 'CERRADA', cerrada_en = CURRENT_TIMESTAMP
     WHERE id_aguinaldo = $1 AND estado = 'APROBADA' AND estado_contabilidad = 'CONFIRMADA' AND estado_pagos = 'CONFIRMADA'`,
    [id]
  );
  return rowCount === 1;
}

async function reabrirIntegracion(cliente, id, destino) {
  const c = CAMPO_DESTINO[destino];
  const { rowCount } = await cliente.query(
    `UPDATE planilla_aguinaldo
     SET estado_${c} = 'PENDIENTE', referencia_${c} = NULL, motivo_${c} = NULL, respondida_${c}_en = NULL
     WHERE id_aguinaldo = $1 AND estado = 'APROBADA' AND estado_${c} = 'RECHAZADA'`,
    [id]
  );
  return rowCount === 1;
}

module.exports = {
  listar,
  obtener,
  bloquearGestion,
  bloquear,
  crear,
  reemplazar,
  guardarEmpleados,
  listarEmpleados,
  eliminar,
  aprobar,
  contarEmpleados,
  empleadosDeIntegracion,
  montosPorCentroDeCosto,
  responder,
  cerrarSiConfirmada,
  reabrirIntegracion,
};
