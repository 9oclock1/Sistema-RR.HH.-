const pool = require("../config/db");
const { ErrorApp } = require("../utils/errores");
const { formatearNumeroDocumento } = require("../utils/finiquitos");

// AC2: impide recalcular promedio, beneficios o saldos cuando el finiquito ya fue aprobado o pagado.
async function asegurarEditable(cliente, idProceso) {
  const { rows } = await cliente.query(
    `SELECT estado
       FROM FINIQUITOS
      WHERE id_proceso = $1
        AND estado IN ('APROBADO', 'PAGADO')
      LIMIT 1`,
    [idProceso]
  );
  if (rows[0]) {
    throw new ErrorApp(
      409,
      "El finiquito ya fue aprobado: el proceso está bloqueado para edición.",
      undefined,
      "FINIQUITO_APROBADO"
    );
  }
}

async function bloquearProceso(cliente, idProceso) {
  const { rows } = await cliente.query(
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
      WHERE p.id_proceso = $1
      FOR UPDATE OF p`,
    [idProceso]
  );
  return rows[0] || null;
}

async function obtenerProcesoDetalle(idProceso, db = pool) {
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
            p.observaciones,
            p.creado_en
       FROM PROCESOS_DESVINCULACION p
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
      WHERE p.id_proceso = $1`,
    [idProceso]
  );
  return rows[0] || null;
}

async function obtenerInsumos(idProceso, idEmpleado, db = pool) {
  const [{ rows: promRows }, { rows: benRows }, { rows: salRows }, { rows: prestRows }] = await Promise.all([
    db.query(
      `SELECT id_proceso, promedio, meses_considerados, calculado_en
         FROM PROMEDIOS_INDEMNIZABLES
        WHERE id_proceso = $1`,
      [idProceso]
    ),
    db.query(
      `SELECT id_proceso, promedio_base, anios_servicio, meses_servicio, dias_fraccion,
              monto_indemnizacion, monto_desahucio, total, calculado_en
         FROM BENEFICIOS_SOCIALES
        WHERE id_proceso = $1`,
      [idProceso]
    ),
    db.query(
      `SELECT id_proceso, promedio, gestion_aguinaldo, aguinaldo_meses, aguinaldo_dias, monto_aguinaldo,
              dias_pendientes, monto_vacaciones_pendientes, anio_en_curso_meses, anio_en_curso_dias,
              monto_duodecima_vacaciones, total, calculado_en
         FROM SALDOS_PROPORCIONALES
        WHERE id_proceso = $1`,
      [idProceso]
    ),
    db.query(
      `SELECT id_prestamo, tipo, monto, saldo_pendiente, estado,
              to_char(mes_inicio, 'YYYY-MM-DD') AS mes_inicio, creado_en
         FROM PRESTAMOS
        WHERE id_empleado = $1
          AND estado = 'ACTIVO'
          AND saldo_pendiente > 0
        ORDER BY creado_en ASC, mes_inicio ASC, id_prestamo ASC`,
      [idEmpleado]
    ),
  ]);

  return {
    promedio: promRows[0] || null,
    beneficios: benRows[0] || null,
    saldos: salRows[0] || null,
    prestamos: prestRows,
  };
}

function mapearFiniquito(cabecera, renglones = []) {
  if (!cabecera) return null;
  return {
    id_finiquito: cabecera.id_finiquito,
    id_proceso: cabecera.id_proceso,
    numero_documento: cabecera.numero_documento,
    estado: cabecera.estado,
    fecha_retiro: cabecera.fecha_retiro,
    codigo_causal: cabecera.codigo_causal,
    promedio_base: Number(cabecera.promedio_base),
    anios_servicio: Number(cabecera.anios_servicio),
    meses_servicio: Number(cabecera.meses_servicio),
    dias_fraccion: Number(cabecera.dias_fraccion),
    total_ingresos: Number(cabecera.total_ingresos),
    total_descuentos: Number(cabecera.total_descuentos),
    liquido_pagable: Number(cabecera.liquido_pagable),
    estado_pagos: cabecera.estado_pagos,
    referencia_pagos: cabecera.referencia_pagos,
    motivo_pagos: cabecera.motivo_pagos,
    respondida_pagos_en: cabecera.respondida_pagos_en,
    estado_contabilidad: cabecera.estado_contabilidad,
    referencia_contabilidad: cabecera.referencia_contabilidad,
    motivo_contabilidad: cabecera.motivo_contabilidad,
    respondida_contabilidad_en: cabecera.respondida_contabilidad_en,
    generado_por: cabecera.generado_por,
    generado_en: cabecera.generado_en,
    aprobado_por: cabecera.aprobado_por,
    aprobado_por_rol: cabecera.aprobado_por_rol,
    aprobado_en: cabecera.aprobado_en,
    pagado_en: cabecera.pagado_en,
    renglones: renglones.map((r) => ({
      orden: Number(r.orden),
      tipo: r.tipo,
      codigo: r.codigo,
      concepto: r.concepto,
      detalle: r.detalle,
      monto: Number(r.monto),
      id_prestamo: r.id_prestamo,
      saldo_prestamo: r.saldo_prestamo !== null ? Number(r.saldo_prestamo) : null,
    })),
  };
}

async function obtenerPorProceso(idProceso, db = pool, { bloquear = false } = {}) {
  const { rows } = await db.query(
    `SELECT id_finiquito, id_proceso, numero_documento, estado,
            to_char(fecha_retiro, 'YYYY-MM-DD') AS fecha_retiro,
            codigo_causal, promedio_base, anios_servicio, meses_servicio, dias_fraccion,
            total_ingresos, total_descuentos, liquido_pagable,
            estado_pagos, referencia_pagos, motivo_pagos, respondida_pagos_en,
            estado_contabilidad, referencia_contabilidad, motivo_contabilidad, respondida_contabilidad_en,
            generado_por, generado_en, aprobado_por, aprobado_por_rol, aprobado_en, pagado_en
       FROM FINIQUITOS
      WHERE id_proceso = $1${bloquear ? " FOR UPDATE" : ""}`,
    [idProceso]
  );
  const cabecera = rows[0];
  if (!cabecera) return null;

  const { rows: renglones } = await db.query(
    `SELECT orden, tipo, codigo, concepto, detalle, monto, id_prestamo, saldo_prestamo
       FROM DETALLE_FINIQUITO
      WHERE id_finiquito = $1
      ORDER BY orden ASC`,
    [cabecera.id_finiquito]
  );
  return mapearFiniquito(cabecera, renglones);
}

async function guardarBorrador(cliente, datos) {
  let idFiniquito = datos.id_finiquito ?? null;

  if (idFiniquito) {
    await cliente.query(
      `UPDATE FINIQUITOS
          SET fecha_retiro = $2,
              codigo_causal = $3,
              promedio_base = $4,
              anios_servicio = $5,
              meses_servicio = $6,
              dias_fraccion = $7,
              total_ingresos = $8,
              total_descuentos = $9,
              liquido_pagable = $10,
              generado_por = $11,
              generado_en = CURRENT_TIMESTAMP
        WHERE id_finiquito = $1
          AND estado = 'BORRADOR'`,
      [
        idFiniquito,
        datos.fecha_retiro,
        datos.codigo_causal,
        datos.promedio_base,
        datos.anios_servicio,
        datos.meses_servicio,
        datos.dias_fraccion,
        datos.total_ingresos,
        datos.total_descuentos,
        datos.liquido_pagable,
        datos.generado_por,
      ]
    );
    await cliente.query(`DELETE FROM DETALLE_FINIQUITO WHERE id_finiquito = $1`, [idFiniquito]);
  } else {
    const { rows } = await cliente.query(
      `INSERT INTO FINIQUITOS (
         id_proceso, estado, fecha_retiro, codigo_causal, promedio_base,
         anios_servicio, meses_servicio, dias_fraccion,
         total_ingresos, total_descuentos, liquido_pagable, generado_por
       )
       VALUES ($1, 'BORRADOR', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id_finiquito`,
      [
        datos.id_proceso,
        datos.fecha_retiro,
        datos.codigo_causal,
        datos.promedio_base,
        datos.anios_servicio,
        datos.meses_servicio,
        datos.dias_fraccion,
        datos.total_ingresos,
        datos.total_descuentos,
        datos.liquido_pagable,
        datos.generado_por,
      ]
    );
    idFiniquito = rows[0].id_finiquito;
  }

  for (const r of datos.renglones) {
    await cliente.query(
      `INSERT INTO DETALLE_FINIQUITO (
         id_finiquito, orden, tipo, codigo, concepto, detalle, monto, id_prestamo, saldo_prestamo
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        idFiniquito,
        r.orden,
        r.tipo,
        r.codigo,
        r.concepto,
        r.detalle,
        r.monto,
        r.id_prestamo,
        r.saldo_prestamo,
      ]
    );
  }
  return idFiniquito;
}

async function siguienteNumeroDocumento(cliente) {
  const { rows } = await cliente.query(
    `SELECT nextval('seq_numero_finiquito') AS seq,
            EXTRACT(YEAR FROM CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::int AS anio`
  );
  return formatearNumeroDocumento(rows[0].seq, rows[0].anio);
}

async function marcarAprobado(cliente, idFiniquito, { numero_documento, aprobado_por, aprobado_por_rol }) {
  const { rows } = await cliente.query(
    `UPDATE FINIQUITOS
        SET estado = 'APROBADO',
            numero_documento = $2,
            aprobado_por = $3,
            aprobado_por_rol = $4,
            aprobado_en = CURRENT_TIMESTAMP
      WHERE id_finiquito = $1
        AND estado = 'BORRADOR'
      RETURNING aprobado_en`,
    [idFiniquito, numero_documento, aprobado_por, aprobado_por_rol]
  );
  return rows[0] || null;
}

async function guardarDocumento(cliente, idFiniquito, { nombre_archivo, contenido }) {
  await cliente.query(
    `INSERT INTO DOCUMENTOS_FINIQUITO (id_finiquito, nombre_archivo, contenido, tamano_bytes)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id_finiquito) DO NOTHING`,
    [idFiniquito, nombre_archivo, contenido, contenido.length]
  );
}

async function obtenerDocumento(idFiniquito, db = pool) {
  const { rows } = await db.query(
    `SELECT id_finiquito, nombre_archivo, contenido, tamano_bytes, generado_en
       FROM DOCUMENTOS_FINIQUITO
      WHERE id_finiquito = $1`,
    [idFiniquito]
  );
  return rows[0] || null;
}

async function listarProcesos({ estado_finiquito } = {}, db = pool) {
  const condiciones = ["p.estado <> 'ANULADO'"];
  const params = [];

  if (estado_finiquito === "SIN_GENERAR") {
    condiciones.push("f.id_finiquito IS NULL");
  } else if (estado_finiquito) {
    params.push(estado_finiquito);
    condiciones.push(`f.estado = $${params.length}`);
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
            p.corresponde_desahucio,
            p.creado_en,
            f.id_finiquito,
            f.estado AS finiquito_estado,
            f.numero_documento,
            f.liquido_pagable,
            f.estado_pagos,
            f.estado_contabilidad,
            f.generado_en,
            f.aprobado_en,
            f.pagado_en
       FROM PROCESOS_DESVINCULACION p
       JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
       LEFT JOIN FINIQUITOS f ON f.id_proceso = p.id_proceso
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
    corresponde_desahucio: r.corresponde_desahucio,
    creado_en: r.creado_en,
    finiquito: r.id_finiquito
      ? {
          id_finiquito: r.id_finiquito,
          estado: r.finiquito_estado,
          numero_documento: r.numero_documento,
          liquido_pagable: Number(r.liquido_pagable),
          estado_pagos: r.estado_pagos,
          estado_contabilidad: r.estado_contabilidad,
          generado_en: r.generado_en,
          aprobado_en: r.aprobado_en,
          pagado_en: r.pagado_en,
        }
      : null,
  }));
}

module.exports = {
  asegurarEditable,
  bloquearProceso,
  obtenerProcesoDetalle,
  obtenerInsumos,
  obtenerPorProceso,
  guardarBorrador,
  siguienteNumeroDocumento,
  marcarAprobado,
  guardarDocumento,
  obtenerDocumento,
  listarProcesos,
};
