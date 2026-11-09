const pool = require("../config/db");

async function listar({ id_empleado, estado }) {
  const condiciones = [];
  const params = [];
  if (id_empleado) {
    params.push(id_empleado);
    condiciones.push(`p.id_empleado = $${params.length}`);
  }
  if (estado) {
    params.push(estado);
    condiciones.push(`p.estado = $${params.length}`);
  }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT p.* FROM prestamos p ${filtro} ORDER BY p.creado_en DESC`,
    params
  );
  return rows;
}

async function obtener(id) {
  const { rows } = await pool.query("SELECT * FROM prestamos WHERE id_prestamo = $1", [id]);
  return rows[0];
}

async function listarCuotas(idPrestamo) {
  const { rows } = await pool.query(
    "SELECT id_cuota, numero_cuota, periodo, monto, estado, pagada_en FROM cuotas_prestamo " +
      "WHERE id_prestamo = $1 ORDER BY numero_cuota",
    [idPrestamo]
  );
  return rows;
}

// Suma, por periodo, las cuotas pendientes que el colaborador ya tiene comprometidas en OTROS préstamos
// activos: el tope de descuento se evalúa sobre el total comprometido, no sobre un préstamo aislado.
async function sumarComprometidoPorPeriodo(idEmpleado) {
  const { rows } = await pool.query(
    `SELECT c.periodo, SUM(c.monto) AS total
       FROM cuotas_prestamo c
       JOIN prestamos p ON p.id_prestamo = c.id_prestamo
      WHERE p.id_empleado = $1 AND p.estado = 'ACTIVO' AND c.estado = 'PENDIENTE'
      GROUP BY c.periodo`,
    [idEmpleado]
  );
  return Object.fromEntries(rows.map((fila) => [fila.periodo, Number(fila.total)]));
}

// Periodo más antiguo que todavía tiene cuotas pendientes, de cualquier préstamo. null si no hay ninguna.
async function obtenerPeriodoPendienteMasAntiguo() {
  const { rows } = await pool.query(
    "SELECT MIN(periodo) AS periodo FROM cuotas_prestamo WHERE estado = 'PENDIENTE'"
  );
  return rows[0].periodo || null;
}

async function crear(cliente, prestamo) {
  const { rows } = await cliente.query(
    `INSERT INTO prestamos (id_empleado, tipo, monto, numero_cuotas, mes_inicio, motivo,
                            liquido_pagable_referencial, porcentaje_cuota, saldo_pendiente)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $3)
     RETURNING id_prestamo`,
    [
      prestamo.id_empleado,
      prestamo.tipo,
      prestamo.monto,
      prestamo.numero_cuotas,
      prestamo.mes_inicio,
      prestamo.motivo,
      prestamo.liquido_pagable_referencial,
      prestamo.porcentaje_cuota,
    ]
  );
  return rows[0].id_prestamo;
}

async function crearCuotas(cliente, idPrestamo, cuotas) {
  for (const cuota of cuotas) {
    await cliente.query(
      "INSERT INTO cuotas_prestamo (id_prestamo, numero_cuota, periodo, monto) VALUES ($1, $2, $3, $4)",
      [idPrestamo, cuota.numero_cuota, cuota.periodo, cuota.monto]
    );
  }
}

// Cuotas pendientes de un periodo (de todos los préstamos activos): lo que la planilla de ese mes debe
// descontar a cada colaborador.
async function listarCuotasDelPeriodo(periodo) {
  const { rows } = await pool.query(
    `SELECT c.id_cuota, c.id_prestamo, p.id_empleado, p.tipo, c.numero_cuota, c.monto
       FROM cuotas_prestamo c
       JOIN prestamos p ON p.id_prestamo = c.id_prestamo
      WHERE c.periodo = $1 AND c.estado = 'PENDIENTE'
      ORDER BY p.id_empleado`,
    [periodo]
  );
  return rows;
}

// Marca como pagadas las cuotas pendientes del periodo y descuenta su monto del saldo de cada préstamo;
// el préstamo que llega a saldo 0 queda COMPLETADO. Todo bajo la misma transacción que el llamador abrió.
async function cerrarPeriodo(cliente, periodo) {
  const { rows: cuotas } = await cliente.query(
    "SELECT id_cuota, id_prestamo, monto FROM cuotas_prestamo WHERE periodo = $1 AND estado = 'PENDIENTE' FOR UPDATE",
    [periodo]
  );
  for (const cuota of cuotas) {
    await cliente.query(
      "UPDATE cuotas_prestamo SET estado = 'PAGADA', pagada_en = CURRENT_TIMESTAMP WHERE id_cuota = $1",
      [cuota.id_cuota]
    );
    await cliente.query(
      `UPDATE prestamos
          SET saldo_pendiente = GREATEST(saldo_pendiente - $1, 0),
              estado = CASE WHEN saldo_pendiente - $1 <= 0 THEN 'COMPLETADO' ELSE estado END,
              actualizado_en = CURRENT_TIMESTAMP
        WHERE id_prestamo = $2`,
      [cuota.monto, cuota.id_prestamo]
    );
  }
  return cuotas.length;
}

module.exports = {
  listar,
  obtener,
  listarCuotas,
  crear,
  crearCuotas,
  listarCuotasDelPeriodo,
  cerrarPeriodo,
  sumarComprometidoPorPeriodo,
  obtenerPeriodoPendienteMasAntiguo,
};
