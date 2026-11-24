const pool = require("../config/db");

async function listarProcesosParaCierre({ estado = null } = {}, db = pool) {
  const condiciones = ["p.estado <> 'ANULADO'", "f.estado IN ('APROBADO', 'PAGADO')"];
  const params = [];

  if (estado === "PENDIENTE_CIERRE") {
    condiciones.push("ci.id_cierre IS NULL");
  } else if (estado) {
    params.push(estado);
    condiciones.push(`ci.estado_revocaciones = $${params.length}`);
  }

  const { rows } = await db.query(
    `SELECT p.id_proceso,
            p.id_empleado,
            p.nombre_empleado,
            to_char(p.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
            to_char(p.fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro,
            p.codigo_causal,
            c.nombre AS causal_nombre,
            p.estado AS estado_proceso,
            p.creado_en,
            f.id_finiquito,
            f.numero_documento,
            f.estado AS finiquito_estado,
            f.liquido_pagable,
            ci.id_cierre,
            ci.estado_revocaciones,
            ci.cuenta_estado,
            ci.cerrado_en,
            ci.completado_en
       FROM PROCESOS_DESVINCULACION p
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
       JOIN FINIQUITOS f ON f.id_proceso = p.id_proceso
       LEFT JOIN CIERRES_DESVINCULACION ci ON ci.id_proceso = p.id_proceso
      WHERE ${condiciones.join(" AND ")}
      ORDER BY p.creado_en DESC`,
    params
  );

  return rows.map((r) => ({
    id_proceso: r.id_proceso,
    id_empleado: r.id_empleado,
    nombre_empleado: r.nombre_empleado,
    fecha_ingreso: r.fecha_ingreso,
    fecha_retiro: r.fecha_retiro,
    causal: { codigo: r.codigo_causal, nombre: r.causal_nombre },
    estado: r.estado_proceso,
    creado_en: r.creado_en,
    finiquito: {
      id_finiquito: r.id_finiquito,
      numero_documento: r.numero_documento,
      estado: r.finiquito_estado,
      liquido_pagable: Number(r.liquido_pagable),
    },
    cierre: r.id_cierre
      ? {
          id_cierre: r.id_cierre,
          estado_revocaciones: r.estado_revocaciones,
          cuenta_estado: r.cuenta_estado,
          cerrado_en: r.cerrado_en,
          completado_en: r.completado_en,
        }
      : null,
  }));
}

async function obtenerProcesoParaCierre(idProceso, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT p.id_proceso,
            p.id_empleado,
            p.nombre_empleado,
            to_char(p.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
            p.codigo_causal,
            c.nombre AS causal_nombre,
            to_char(p.fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro,
            p.corresponde_desahucio,
            p.estado,
            p.observaciones
       FROM PROCESOS_DESVINCULACION p
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
      WHERE p.id_proceso = $1${bloquear ? " FOR UPDATE OF p" : ""}`,
    [idProceso]
  );
  return rows[0] || null;
}

async function obtenerFiniquitoDeProceso(idProceso, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT id_finiquito, id_proceso, numero_documento, estado, liquido_pagable, aprobado_en, pagado_en
       FROM FINIQUITOS
      WHERE id_proceso = $1${bloquear ? " FOR UPDATE" : ""}`,
    [idProceso]
  );
  return rows[0] || null;
}

async function obtenerCierrePorProceso(idProceso, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT id_cierre, id_proceso, id_finiquito, id_empleado, estado_finiquito_al_cerrar,
            empleado_inactivado_en, cuenta_estado, cuenta_revocada_en, estado_revocaciones,
            cerrado_por, cerrado_por_rol, cerrado_en, completado_en
       FROM CIERRES_DESVINCULACION
      WHERE id_proceso = $1${bloquear ? " FOR UPDATE" : ""}`,
    [idProceso]
  );
  return rows[0] || null;
}

async function crearCierre(cliente, datos) {
  const { rows } = await cliente.query(
    `INSERT INTO CIERRES_DESVINCULACION (
       id_proceso, id_finiquito, id_empleado, estado_finiquito_al_cerrar,
       empleado_inactivado_en, cuenta_estado, cuenta_revocada_en,
       estado_revocaciones, cerrado_por, cerrado_por_rol
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'EN_PROCESO', $8, $9)
     RETURNING id_cierre, id_proceso, id_finiquito, id_empleado, estado_finiquito_al_cerrar,
               empleado_inactivado_en, cuenta_estado, cuenta_revocada_en, estado_revocaciones,
               cerrado_por, cerrado_por_rol, cerrado_en, completado_en`,
    [
      datos.id_proceso,
      datos.id_finiquito,
      datos.id_empleado,
      datos.estado_finiquito_al_cerrar,
      datos.empleado_inactivado_en,
      datos.cuenta_estado,
      datos.cuenta_revocada_en,
      datos.cerrado_por,
      datos.cerrado_por_rol,
    ]
  );
  return rows[0];
}

async function crearRevocacionesIniciales(cliente, idCierre, destinos) {
  for (const destino of destinos) {
    await cliente.query(
      `INSERT INTO REVOCACIONES_SISTEMA (id_cierre, destino, estado)
       VALUES ($1, $2, 'PENDIENTE')`,
      [idCierre, destino]
    );
  }
}

async function cerrarProcesoDesvinculacion(cliente, idProceso) {
  await cliente.query(
    `UPDATE PROCESOS_DESVINCULACION
        SET estado = 'CERRADO',
            actualizado_en = CURRENT_TIMESTAMP
      WHERE id_proceso = $1`,
    [idProceso]
  );
}

async function listarRevocacionesCierre(idCierre, db = pool) {
  const { rows } = await db.query(
    `SELECT id_revocacion, id_cierre, destino, estado, plazo_vence_en, reenvios_por_plazo,
            recursos_revocados, referencia, motivo, respondida_en, actualizado_en
       FROM REVOCACIONES_SISTEMA
      WHERE id_cierre = $1`,
    [idCierre]
  );
  return rows;
}

async function ultimosEnviosPorDestino(idCierre, db = pool) {
  const { rows } = await db.query(
    `SELECT DISTINCT ON (destino)
            id_evento, id_mensaje, destino, estado, intentos, ultimo_error,
            proximo_intento_en, entregado_en, creado_en
       FROM EVENTOS_CIERRE
      WHERE id_cierre = $1
        AND sentido = 'SALIENTE'
      ORDER BY destino, creado_en DESC, id_evento DESC`,
    [idCierre]
  );
  return Object.fromEntries(rows.map((r) => [r.destino, r]));
}

module.exports = {
  listarProcesosParaCierre,
  obtenerProcesoParaCierre,
  obtenerFiniquitoDeProceso,
  obtenerCierrePorProceso,
  crearCierre,
  crearRevocacionesIniciales,
  cerrarProcesoDesvinculacion,
  listarRevocacionesCierre,
  ultimosEnviosPorDestino,
};
