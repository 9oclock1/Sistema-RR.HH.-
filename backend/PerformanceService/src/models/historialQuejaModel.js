const pool = require("../config/db");

const COLUMNAS = `q.id_queja, q.codigo_seguimiento, q.es_anonima, q.creado_en, f.cerrada_en,
            cq.id_categoria_queja, cq.codigo AS categoria_codigo, cq.nombre AS categoria_nombre,
            pq.id_prioridad_queja, pq.codigo AS prioridad_codigo, pq.nombre AS prioridad_nombre,
            eq.id_estado_queja, eq.codigo AS estado_codigo, eq.nombre AS estado_nombre, eq.es_final,
            su.id_sucursal, su.nombre AS sucursal_nombre,
            va.id_empleado_responsable, r.nombres AS responsable_nombres, r.apellidos AS responsable_apellidos,
            pa.derivada_en,
            (SELECT count(*)::int FROM acciones_queja ac WHERE ac.id_queja = q.id_queja) AS acciones`;

const ORIGEN = `FROM quejas q
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = q.id_estado_queja
     JOIN catalogos_categoria_queja cq ON cq.id_categoria_queja = q.id_categoria_queja
     LEFT JOIN catalogos_prioridad_queja pq ON pq.id_prioridad_queja = q.id_prioridad_queja
     LEFT JOIN sucursales su ON su.id_sucursal = q.id_sucursal
     LEFT JOIN LATERAL (
       SELECT h.fecha_cambio FROM historiales_estado_queja h
       WHERE h.id_queja = q.id_queja AND h.id_estado_queja = q.id_estado_queja
       ORDER BY h.fecha_cambio DESC
       LIMIT 1
     ) c ON TRUE
     CROSS JOIN LATERAL (SELECT COALESCE(c.fecha_cambio, q.actualizado_en) AS cerrada_en) f`;

const DERIVACIONES = `LEFT JOIN LATERAL (
       SELECT id_empleado_responsable FROM asignaciones_queja
       WHERE id_queja = q.id_queja
       ORDER BY asignada_en DESC
       LIMIT 1
     ) va ON TRUE
     LEFT JOIN empleados r ON r.id_empleado = va.id_empleado_responsable
     LEFT JOIN LATERAL (
       SELECT min(asignada_en) AS derivada_en FROM asignaciones_queja WHERE id_queja = q.id_queja
     ) pa ON TRUE`;

const FILTROS = `eq.es_final
   AND ($1::date IS NULL OR f.cerrada_en >= ($1::date)::timestamp AT TIME ZONE $6::text)
   AND ($2::date IS NULL OR f.cerrada_en < ($2::date + 1)::timestamp AT TIME ZONE $6::text)
   AND ($3::smallint IS NULL OR q.id_categoria_queja = $3)
   AND ($4::uuid IS NULL OR q.id_sucursal = $4)
   AND ($5::boolean IS FALSE OR q.id_sucursal IS NULL)`;

const parametros = ({ desde, hasta, idCategoria, idSucursal, sinSucursal, zonaHoraria }) => [
  desde,
  hasta,
  idCategoria,
  idSucursal,
  sinSucursal,
  zonaHoraria,
];

const ORDEN = "ORDER BY f.cerrada_en DESC, q.id_queja";

async function listarCerradas(filtros, db = pool) {
  const paginar = Boolean(filtros.limite);
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}
     ${ORIGEN}
     ${DERIVACIONES}
     WHERE ${FILTROS}
     ${ORDEN}
     ${paginar ? "LIMIT $7 OFFSET $8" : ""}`,
    paginar
      ? [...parametros(filtros), filtros.limite, (filtros.pagina - 1) * filtros.limite]
      : parametros(filtros),
  );
  return rows;
}

async function contarCerradas(filtros, db = pool) {
  const { rows } = await db.query(
    `SELECT count(*)::int AS total
     ${ORIGEN}
     WHERE ${FILTROS}`,
    parametros(filtros),
  );
  return rows[0].total;
}

async function obtenerCerrada(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}, q.resolucion
     ${ORIGEN}
     ${DERIVACIONES}
     WHERE q.id_queja = $1 AND eq.es_final`,
    [idQueja],
  );
  return rows[0] ?? null;
}

async function listarSucursales(db = pool) {
  const { rows } = await db.query(`SELECT id_sucursal, nombre FROM sucursales ORDER BY nombre, id_sucursal`);
  return rows;
}

module.exports = { listarCerradas, contarCerradas, obtenerCerrada, listarSucursales };
