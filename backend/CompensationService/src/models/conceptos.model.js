const pool = require("../config/db");

// $1 = fecha de referencia: trae la vigencia de ese día y la siguiente programada.
const CON_VIGENCIA = `
  SELECT c.*,
         v.id_vigencia, v.valor, v.vigente_desde, v.vigente_hasta,
         p.valor AS proximo_valor, p.vigente_desde AS proximo_desde
  FROM conceptos_planilla c
  LEFT JOIN vigencias_concepto v
    ON v.id_concepto = c.id_concepto
   AND v.vigente_desde <= $1 AND (v.vigente_hasta IS NULL OR v.vigente_hasta >= $1)
  LEFT JOIN LATERAL (
    SELECT valor, vigente_desde FROM vigencias_concepto
    WHERE id_concepto = c.id_concepto AND vigente_desde > $1
    ORDER BY vigente_desde LIMIT 1
  ) p ON TRUE`;

const ORDEN_TIPO = "CASE c.tipo WHEN 'INGRESO' THEN 1 WHEN 'DESCUENTO' THEN 2 ELSE 3 END";

async function listar({ fecha, tipo, activo, soloVigentes }) {
  const condiciones = [];
  const params = [fecha];
  if (tipo) {
    params.push(tipo);
    condiciones.push(`c.tipo = $${params.length}`);
  }
  if (activo !== undefined) {
    params.push(activo);
    condiciones.push(`c.esta_activo = $${params.length}`);
  }
  if (soloVigentes) condiciones.push("v.id_vigencia IS NOT NULL");
  const filtro = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await pool.query(`${CON_VIGENCIA} ${filtro} ORDER BY ${ORDEN_TIPO}, c.codigo`, params);
  return rows;
}

async function obtener(id, fecha) {
  const { rows } = await pool.query(`${CON_VIGENCIA} WHERE c.id_concepto = $2`, [fecha, id]);
  return rows[0];
}

async function listarVigencias(id) {
  const { rows } = await pool.query(
    `SELECT id_vigencia, valor, vigente_desde, vigente_hasta, creado_en
     FROM vigencias_concepto WHERE id_concepto = $1 ORDER BY vigente_desde DESC`,
    [id]
  );
  return rows;
}

async function crear(cliente, c) {
  const { rows } = await cliente.query(
    `INSERT INTO conceptos_planilla (codigo, nombre, descripcion, tipo, forma_calculo, base_calculo,
                                     es_de_ley, cuenta_contable_codigo, cuenta_contable_nombre)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_concepto`,
    [
      c.codigo,
      c.nombre,
      c.descripcion,
      c.tipo,
      c.forma_calculo,
      c.base_calculo,
      c.es_de_ley,
      c.cuenta_contable_codigo,
      c.cuenta_contable_nombre,
    ]
  );
  return rows[0].id_concepto;
}

async function actualizar(id, c) {
  const { rowCount } = await pool.query(
    `UPDATE conceptos_planilla
     SET codigo = $1, nombre = $2, descripcion = $3, base_calculo = $4, es_de_ley = $5,
         cuenta_contable_codigo = $6, cuenta_contable_nombre = $7, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_concepto = $8`,
    [
      c.codigo,
      c.nombre,
      c.descripcion,
      c.base_calculo,
      c.es_de_ley,
      c.cuenta_contable_codigo,
      c.cuenta_contable_nombre,
      id,
    ]
  );
  return rowCount;
}

async function cambiarEstado(id, activo) {
  const { rowCount } = await pool.query(
    `UPDATE conceptos_planilla SET esta_activo = $1, actualizado_en = CURRENT_TIMESTAMP
     WHERE id_concepto = $2`,
    [activo, id]
  );
  return rowCount;
}

async function eliminar(id) {
  const { rowCount } = await pool.query("DELETE FROM conceptos_planilla WHERE id_concepto = $1", [id]);
  return rowCount;
}

// Bloquea el concepto para que dos vigencias nuevas no se registren a la vez.
async function bloquear(cliente, id) {
  const { rows } = await cliente.query(
    "SELECT id_concepto, codigo, forma_calculo FROM conceptos_planilla WHERE id_concepto = $1 FOR UPDATE",
    [id]
  );
  return rows[0];
}

async function ultimaVigencia(cliente, id) {
  const { rows } = await cliente.query(
    `SELECT id_vigencia, vigente_desde, vigente_hasta FROM vigencias_concepto
     WHERE id_concepto = $1 ORDER BY vigente_desde DESC LIMIT 1`,
    [id]
  );
  return rows[0];
}

async function cerrarVigencia(cliente, idVigencia, hasta) {
  await cliente.query("UPDATE vigencias_concepto SET vigente_hasta = $1 WHERE id_vigencia = $2", [
    hasta,
    idVigencia,
  ]);
}

async function crearVigencia(cliente, idConcepto, v) {
  const { rows } = await cliente.query(
    `INSERT INTO vigencias_concepto (id_concepto, valor, vigente_desde, vigente_hasta)
     VALUES ($1, $2, $3, $4)
     RETURNING id_vigencia, valor, vigente_desde, vigente_hasta, creado_en`,
    [idConcepto, v.valor, v.vigente_desde, v.vigente_hasta]
  );
  return rows[0];
}

module.exports = {
  listar,
  obtener,
  listarVigencias,
  crear,
  actualizar,
  cambiarEstado,
  eliminar,
  bloquear,
  ultimaVigencia,
  cerrarVigencia,
  crearVigencia,
};
