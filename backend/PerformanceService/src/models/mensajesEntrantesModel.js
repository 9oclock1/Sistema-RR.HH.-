const pool = require("../config/db");
const { MODULO_EXTERNO } = require("../utils/ciclos");
const { ESTADO_MENSAJE } = require("../utils/metricasCrm");

const COLUMNAS = `m.id_mensaje, m.id_mensaje_externo, m.tipo_evento, m.carga, m.intentos, m.ultimo_error,
                  m.recibido_en, m.procesado_en, m.id_estado_mensaje, ce.codigo AS estado`;

// Guarda lo que llegó del CRM. Si ese `id_mensaje_externo` ya estaba registrado es una segunda entrega del mismo
// mensaje (Pub/Sub entrega al menos una vez): se devuelve el original con duplicado = true y no se toca nada.
async function registrar({ idExterno, tipoEvento, carga }, db = pool) {
  const { rows } = await db.query(
    `INSERT INTO mensajes_entrantes (id_modulo_origen, id_estado_mensaje, id_mensaje_externo, tipo_evento, carga)
     VALUES (${MODULO_EXTERNO.CRM}, ${ESTADO_MENSAJE.RECIBIDO}, $1, $2, $3)
     ON CONFLICT ON CONSTRAINT uq_mensaje_origen_externo DO NOTHING
     RETURNING id_mensaje`,
    [idExterno, tipoEvento, carga],
  );
  if (rows[0]) return { fila: await obtener(rows[0].id_mensaje, db), duplicado: false };

  const { rows: existentes } = await db.query(
    `SELECT id_mensaje FROM mensajes_entrantes WHERE id_modulo_origen = ${MODULO_EXTERNO.CRM} AND id_mensaje_externo = $1`,
    [idExterno],
  );
  return { fila: await obtener(existentes[0].id_mensaje, db), duplicado: true };
}

async function obtener(idMensaje, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}
     FROM mensajes_entrantes m JOIN catalogos_estado_mensaje ce ON ce.id_estado_mensaje = m.id_estado_mensaje
     WHERE m.id_mensaje = $1`,
    [idMensaje],
  );
  return rows[0] ?? null;
}

// Bloquea la fila durante la transacción: dos procesos no pueden aplicar el mismo mensaje a la vez.
async function bloquear(idMensaje, db) {
  const { rows } = await db.query(
    "SELECT id_mensaje, id_estado_mensaje, carga FROM mensajes_entrantes WHERE id_mensaje = $1 FOR UPDATE",
    [idMensaje],
  );
  return rows[0] ?? null;
}

// `intentos` cuenta las entregas procesadas: las fallidas y, al final, la que sí se aplicó.
async function marcarProcesado(idMensaje, db = pool) {
  await db.query(
    `UPDATE mensajes_entrantes
        SET id_estado_mensaje = ${ESTADO_MENSAJE.PROCESADO}, procesado_en = CURRENT_TIMESTAMP,
            intentos = intentos + 1, ultimo_error = NULL
      WHERE id_mensaje = $1 AND id_estado_mensaje = ${ESTADO_MENSAJE.RECIBIDO}`,
    [idMensaje],
  );
}

// Devuelve cuántas entregas fallidas lleva el mensaje (null si ya no estaba en RECIBIDO).
async function registrarFallo(idMensaje, error, db = pool) {
  const { rows } = await db.query(
    `UPDATE mensajes_entrantes SET intentos = intentos + 1, ultimo_error = left($2, 255)
      WHERE id_mensaje = $1 AND id_estado_mensaje = ${ESTADO_MENSAJE.RECIBIDO}
      RETURNING intentos`,
    [idMensaje, error],
  );
  return rows[0]?.intentos ?? null;
}

// Agotó los reintentos: queda para revisión y no vuelve a entregarse solo.
async function enviarADlq(idMensaje, db = pool) {
  await db.query(
    `UPDATE mensajes_entrantes SET id_estado_mensaje = ${ESTADO_MENSAJE.EN_DLQ}
      WHERE id_mensaje = $1 AND id_estado_mensaje = ${ESTADO_MENSAJE.RECIBIDO}`,
    [idMensaje],
  );
}

// Reproceso manual: solo un mensaje en DLQ vuelve a RECIBIDO, con el contador en cero.
async function reabrir(idMensaje, db = pool) {
  const { rowCount } = await db.query(
    `UPDATE mensajes_entrantes
        SET id_estado_mensaje = ${ESTADO_MENSAJE.RECIBIDO}, intentos = 0, ultimo_error = NULL
      WHERE id_mensaje = $1 AND id_estado_mensaje = ${ESTADO_MENSAJE.EN_DLQ}`,
    [idMensaje],
  );
  return rowCount > 0;
}

async function listar({ idEstado = null, limite = 100 } = {}, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS},
            (SELECT count(*)::int FROM metricas_crm mc WHERE mc.id_mensaje = m.id_mensaje) AS metricas
     FROM mensajes_entrantes m JOIN catalogos_estado_mensaje ce ON ce.id_estado_mensaje = m.id_estado_mensaje
     WHERE ($1::smallint IS NULL OR m.id_estado_mensaje = $1)
     ORDER BY m.recibido_en DESC, m.id_mensaje
     LIMIT $2`,
    [idEstado, limite],
  );
  return rows;
}

// Mensajes que se quedaron en RECIBIDO (por ejemplo, el servicio se reinició a mitad de los reintentos).
async function listarRecibidosAntiguos(segundos, db = pool) {
  const { rows } = await db.query(
    `SELECT m.id_mensaje, m.carga, m.intentos FROM mensajes_entrantes m
      WHERE m.id_estado_mensaje = ${ESTADO_MENSAJE.RECIBIDO}
        AND m.recibido_en < CURRENT_TIMESTAMP - make_interval(secs => $1)
      ORDER BY m.recibido_en`,
    [segundos],
  );
  return rows;
}

// Colaboradores evaluados en el ciclo: las únicas personas de las que se aceptan métricas.
async function listarEvaluadosDelCiclo(idCiclo, db = pool) {
  const { rows } = await db.query("SELECT DISTINCT id_empleado_evaluado FROM evaluaciones WHERE id_ciclo = $1", [idCiclo]);
  return rows.map((fila) => fila.id_empleado_evaluado);
}

// Una fila por ciclo y colaborador: un mensaje nuevo con el mismo colaborador reemplaza las métricas anteriores.
async function guardarMetricas(idCiclo, idMensaje, metricas, db = pool) {
  await db.query(
    `INSERT INTO metricas_crm (id_ciclo, id_empleado, id_mensaje, cantidad_quejas, cantidad_felicitaciones, minutos_resolucion_promedio)
     SELECT $1::uuid, t.id_empleado, $2::uuid, t.quejas, t.felicitaciones, t.minutos
     FROM unnest($3::uuid[], $4::int[], $5::int[], $6::numeric[]) AS t (id_empleado, quejas, felicitaciones, minutos)
     ON CONFLICT ON CONSTRAINT uq_metrica_ciclo_empleado DO UPDATE
       SET id_mensaje = EXCLUDED.id_mensaje, cantidad_quejas = EXCLUDED.cantidad_quejas,
           cantidad_felicitaciones = EXCLUDED.cantidad_felicitaciones,
           minutos_resolucion_promedio = EXCLUDED.minutos_resolucion_promedio`,
    [
      idCiclo,
      idMensaje,
      metricas.map((m) => m.idEmpleado),
      metricas.map((m) => m.cantidadQuejas),
      metricas.map((m) => m.cantidadFelicitaciones),
      metricas.map((m) => m.minutosResolucion),
    ],
  );
}

module.exports = {
  registrar,
  obtener,
  bloquear,
  marcarProcesado,
  registrarFallo,
  enviarADlq,
  reabrir,
  listar,
  listarRecibidosAntiguos,
  listarEvaluadosDelCiclo,
  guardarMetricas,
};
