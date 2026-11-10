const pool = require("../config/db");

// ---- Reglas de bono por productividad ----

const COLUMNAS_REGLA = `id_regla, periodo, tipo_meta, umbral_cumplimiento, forma_calculo, valor, esta_activa,
  creado_en, actualizado_en`;

async function listarReglas({ periodo, tipo_meta } = {}) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_REGLA} FROM reglas_bono_productividad
     WHERE ($1::date IS NULL OR periodo = $1) AND ($2::text IS NULL OR tipo_meta = $2)
     ORDER BY periodo DESC, tipo_meta`,
    [periodo ?? null, tipo_meta ?? null]
  );
  return rows;
}

async function obtenerRegla(id) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS_REGLA} FROM reglas_bono_productividad WHERE id_regla = $1`, [id]);
  return rows[0];
}

async function crearRegla({ periodo, tipo_meta, umbral_cumplimiento, forma_calculo, valor }) {
  const { rows } = await pool.query(
    `INSERT INTO reglas_bono_productividad (periodo, tipo_meta, umbral_cumplimiento, forma_calculo, valor)
     VALUES ($1, $2, $3, $4, $5) RETURNING id_regla`,
    [periodo, tipo_meta, umbral_cumplimiento, forma_calculo, valor]
  );
  return rows[0].id_regla;
}

async function actualizarRegla(id, { umbral_cumplimiento, forma_calculo, valor }) {
  const { rowCount } = await pool.query(
    `UPDATE reglas_bono_productividad
     SET umbral_cumplimiento = $2, forma_calculo = $3, valor = $4, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_regla = $1`,
    [id, umbral_cumplimiento, forma_calculo, valor]
  );
  return rowCount;
}

async function cambiarEstadoRegla(id, estaActiva) {
  const { rowCount } = await pool.query(
    `UPDATE reglas_bono_productividad SET esta_activa = $2, actualizado_en = CURRENT_TIMESTAMP WHERE id_regla = $1`,
    [id, estaActiva]
  );
  return rowCount;
}

async function eliminarRegla(id) {
  const { rowCount } = await pool.query("DELETE FROM reglas_bono_productividad WHERE id_regla = $1", [id]);
  return rowCount;
}

async function reglasActivasDelPeriodo(cliente, periodo) {
  const { rows } = await cliente.query(
    `SELECT ${COLUMNAS_REGLA} FROM reglas_bono_productividad WHERE periodo = $1 AND esta_activa`,
    [periodo]
  );
  return rows;
}

// ---- Bandeja de entrada del cierre de ventas (idempotencia) ----

const COLUMNAS_EVENTO = `id_evento_entrante, id_mensaje, topico, tipo_evento, periodo, carga, estado, intentos,
  detalle, recibido_en, procesado_en`;

// Registra el mensaje si es nuevo y lo bloquea: dos entregas del mismo mensaje no se procesan a la vez.
async function reclamar(cliente, { idMensaje, topico, tipoEvento, carga }) {
  await cliente.query(
    `INSERT INTO eventos_ventas_entrantes (id_mensaje, topico, tipo_evento, carga)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_mensaje) DO NOTHING`,
    [idMensaje, topico, tipoEvento, carga]
  );
  const { rows } = await cliente.query(
    `SELECT ${COLUMNAS_EVENTO} FROM eventos_ventas_entrantes WHERE id_mensaje = $1 FOR UPDATE`,
    [idMensaje]
  );
  return rows[0];
}

// Termina un intento: PROCESADO, IGNORADO o FALLIDO (inválido).
async function cerrar(cliente, id, { estado, detalle = null, periodo = null }) {
  await cliente.query(
    `UPDATE eventos_ventas_entrantes
     SET estado = $2::text, detalle = left($3, 255), periodo = COALESCE($4, periodo),
         intentos = intentos + 1,
         procesado_en = CASE WHEN $2::text IN ('PROCESADO', 'IGNORADO') THEN CURRENT_TIMESTAMP ELSE NULL END
     WHERE id_evento_entrante = $1`,
    [id, estado, detalle, periodo]
  );
}

// Un intento que falló por un error pasajero (la base, por ejemplo). Tras `maximo` intentos queda FALLIDO.
async function registrarFallo({ idMensaje, topico, tipoEvento, carga, detalle, maximo }) {
  const { rows } = await pool.query(
    `INSERT INTO eventos_ventas_entrantes AS e (id_mensaje, topico, tipo_evento, carga, intentos, detalle, estado)
     VALUES ($1, $2, $3, $4, 1, left($5, 255), CASE WHEN 1 >= $6 THEN 'FALLIDO' ELSE 'RECIBIDO' END)
     ON CONFLICT (id_mensaje) DO UPDATE
     SET intentos = e.intentos + 1, detalle = left($5, 255),
         estado = CASE WHEN e.intentos + 1 >= $6 THEN 'FALLIDO' ELSE e.estado END
     WHERE e.estado = 'RECIBIDO'
     RETURNING estado, intentos`,
    [idMensaje, topico, tipoEvento, carga, detalle, maximo]
  );
  return rows[0];
}

async function listarEventos({ estado = null, limite }) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNAS_EVENTO} FROM eventos_ventas_entrantes
     WHERE $1::text IS NULL OR estado = $1
     ORDER BY recibido_en DESC
     LIMIT $2`,
    [estado, limite]
  );
  return rows;
}

async function obtenerEvento(db, id) {
  const { rows } = await db.query(`SELECT ${COLUMNAS_EVENTO} FROM eventos_ventas_entrantes WHERE id_evento_entrante = $1`, [id]);
  return rows[0];
}

// Un mensaje fallido vuelve a RECIBIDO para procesarlo otra vez.
async function reabrirEvento(id) {
  const { rows } = await pool.query(
    `UPDATE eventos_ventas_entrantes SET estado = 'RECIBIDO', intentos = 0, detalle = NULL
     WHERE id_evento_entrante = $1 AND estado = 'FALLIDO'
     RETURNING ${COLUMNAS_EVENTO}`,
    [id]
  );
  return rows[0];
}

async function devolverEventoAFallido(id, detalle) {
  await pool.query(
    `UPDATE eventos_ventas_entrantes SET estado = 'FALLIDO', detalle = left($2, 255)
     WHERE id_evento_entrante = $1 AND estado = 'RECIBIDO'`,
    [id, detalle]
  );
}

// ---- Métricas de ventas del periodo ----

// Un periodo reenviado (nuevo id_mensaje con una corrección, no un duplicado) reemplaza la fila anterior del
// colaborador: la clave de negocio es (periodo, id_empleado), no el evento que la trajo.
async function guardarMetricas(cliente, idEventoEntrante, periodo, metricas) {
  const guardadas = [];
  for (const m of metricas) {
    const { rows } = await cliente.query(
      `INSERT INTO metricas_ventas_periodo
         (periodo, id_empleado, rol, monto_ventas, cuota_asignada, porcentaje_cumplimiento, id_evento_entrante)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (periodo, id_empleado) DO UPDATE
       SET rol = EXCLUDED.rol, monto_ventas = EXCLUDED.monto_ventas, cuota_asignada = EXCLUDED.cuota_asignada,
           porcentaje_cumplimiento = EXCLUDED.porcentaje_cumplimiento, id_evento_entrante = EXCLUDED.id_evento_entrante
       RETURNING id_metrica, periodo, id_empleado, rol, monto_ventas, cuota_asignada, porcentaje_cumplimiento`,
      [periodo, m.id_empleado, m.rol, m.monto_ventas, m.cuota_asignada, m.porcentaje_cumplimiento, idEventoEntrante]
    );
    guardadas.push(rows[0]);
  }
  return guardadas;
}

async function metricasDelPeriodo(cliente, periodo) {
  const { rows } = await cliente.query(
    `SELECT id_metrica, periodo, id_empleado, rol, monto_ventas, cuota_asignada, porcentaje_cumplimiento
     FROM metricas_ventas_periodo WHERE periodo = $1`,
    [periodo]
  );
  return rows;
}

// ---- Bonos de productividad generados por el motor ----

// Bonos vigentes del periodo antes de reemplazarlos (RF-53, KAN-73): se lee dentro de la misma transacción
// que el reemplazo, para comparar contra los nuevos y auditar lo que cambió.
async function bonosDelPeriodo(cliente, periodo) {
  const { rows } = await cliente.query(
    "SELECT id_bono, id_empleado, id_regla, id_metrica, porcentaje_cumplimiento, valor, monto FROM bonos_productividad WHERE periodo = $1",
    [periodo]
  );
  return rows;
}

async function reemplazarBonosDelPeriodo(cliente, periodo, bonos) {
  await cliente.query("DELETE FROM bonos_productividad WHERE periodo = $1", [periodo]);
  for (const b of bonos) {
    await cliente.query(
      `INSERT INTO bonos_productividad
         (periodo, id_empleado, id_regla, id_metrica, porcentaje_cumplimiento, valor, monto)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [periodo, b.id_empleado, b.id_regla, b.id_metrica, b.porcentaje_cumplimiento, b.valor, b.monto]
    );
  }
}

async function listarBonosDelPeriodo(periodo) {
  const { rows } = await pool.query(
    `SELECT b.id_bono, b.periodo, b.id_empleado, b.porcentaje_cumplimiento, b.valor, b.monto, b.generado_en,
            r.id_regla, r.tipo_meta, r.umbral_cumplimiento, r.forma_calculo AS regla_forma_calculo,
            m.rol, m.monto_ventas, m.cuota_asignada
     FROM bonos_productividad b
     JOIN reglas_bono_productividad r ON r.id_regla = b.id_regla
     JOIN metricas_ventas_periodo m ON m.id_metrica = b.id_metrica
     WHERE b.periodo = $1
     ORDER BY r.tipo_meta, b.porcentaje_cumplimiento DESC`,
    [periodo]
  );
  return rows;
}

module.exports = {
  listarReglas,
  obtenerRegla,
  crearRegla,
  actualizarRegla,
  cambiarEstadoRegla,
  eliminarRegla,
  reglasActivasDelPeriodo,
  reclamar,
  cerrar,
  registrarFallo,
  listarEventos,
  obtenerEvento,
  reabrirEvento,
  devolverEventoAFallido,
  guardarMetricas,
  metricasDelPeriodo,
  bonosDelPeriodo,
  reemplazarBonosDelPeriodo,
  listarBonosDelPeriodo,
};
