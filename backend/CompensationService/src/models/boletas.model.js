const pool = require("../config/db");

// Detalle de un colaborador en una planilla, con los renglones de su cálculo.
const DETALLE = `pe.id_planilla_empleado, pe.id_planilla, p.periodo, p.estado, p.cerrada_en, pe.id_empleado,
  pe.nombre_empleado, pe.numero_documento, pe.cargo, pe.area, pe.sucursal, pe.numero_contrato, pe.haber_mensual,
  pe.dias_contrato, pe.dias_pagados, pe.faltas_injustificadas, pe.dias_licencia_sin_goce,
  pe.total_ganado, pe.total_descuentos, pe.liquido_pagable, pe.total_aportes,
  COALESCE((SELECT json_agg(json_build_object('orden', k.orden, 'tipo', k.tipo, 'codigo', k.codigo, 'nombre', k.nombre,
                                              'forma_calculo', k.forma_calculo, 'base', k.base, 'cantidad', k.cantidad,
                                              'valor', k.valor, 'resultado', k.resultado, 'detalle', k.detalle)
                            ORDER BY k.orden)
            FROM calculos_planilla k WHERE k.id_planilla_empleado = pe.id_planilla_empleado), '[]') AS renglones`;

// Planillas cerradas del colaborador que todavía no tienen boleta.
async function pendientesDeEmitir(idEmpleado) {
  const { rows } = await pool.query(
    `SELECT ${DETALLE}
     FROM planilla_empleados pe
     JOIN planillas p ON p.id_planilla = pe.id_planilla
     WHERE pe.id_empleado = $1 AND p.estado = 'CERRADA'
       AND NOT EXISTS (SELECT 1 FROM boletas_pago b WHERE b.id_planilla_empleado = pe.id_planilla_empleado)`,
    [idEmpleado]
  );
  return rows;
}

// Si otra consulta la emitió primero, se conserva la que ya existe.
async function emitir(fila, hash) {
  await pool.query(
    `INSERT INTO boletas_pago (id_planilla, id_planilla_empleado, id_empleado, periodo, hash_contenido)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT DO NOTHING`,
    [fila.id_planilla, fila.id_planilla_empleado, fila.id_empleado, fila.periodo, hash]
  );
}

async function listar(idEmpleado) {
  const { rows } = await pool.query(
    `SELECT b.id_boleta, b.periodo, b.emitida_en, b.descargas, b.ultima_descarga_en, p.cerrada_en,
            pe.total_ganado, pe.total_descuentos, pe.liquido_pagable
     FROM boletas_pago b
     JOIN planilla_empleados pe ON pe.id_planilla_empleado = b.id_planilla_empleado
     JOIN planillas p ON p.id_planilla = b.id_planilla
     WHERE b.id_empleado = $1 AND p.estado = 'CERRADA'
     ORDER BY b.periodo DESC`,
    [idEmpleado]
  );
  return rows;
}

async function obtener(idBoleta) {
  const { rows } = await pool.query(
    `SELECT b.id_boleta, b.hash_contenido, b.emitida_en, b.descargas, b.ultima_descarga_en, ${DETALLE}
     FROM boletas_pago b
     JOIN planilla_empleados pe ON pe.id_planilla_empleado = b.id_planilla_empleado
     JOIN planillas p ON p.id_planilla = pe.id_planilla
     WHERE b.id_boleta = $1`,
    [idBoleta]
  );
  return rows[0];
}

async function registrarDescarga(idBoleta) {
  await pool.query(
    "UPDATE boletas_pago SET descargas = descargas + 1, ultima_descarga_en = CURRENT_TIMESTAMP WHERE id_boleta = $1",
    [idBoleta]
  );
}

module.exports = { pendientesDeEmitir, emitir, listar, obtener, registrarDescarga };
