const pool = require("../config/db");

const ESTADO_RESUELTA = 5;

async function listarQuejasDelPeriodo({ desde, hasta, idCategoria, idSucursal, sinSucursal, zonaHoraria }, db = pool) {
  const { rows } = await db.query(
    `WITH periodo AS (
       SELECT ($1::date)::timestamp AT TIME ZONE $6::text AS inicio,
              ($2::date + 1)::timestamp AT TIME ZONE $6::text AS fin
     )
     SELECT q.id_queja, q.es_anonima, q.id_estado_queja,
            cq.id_categoria_queja, cq.nombre AS categoria,
            d.id_departamento, d.nombre AS departamento,
            su.id_sucursal, su.nombre AS sucursal,
            (q.creado_en >= p.inicio AND q.creado_en < p.fin) AS recibida_en_periodo,
            to_char(q.creado_en AT TIME ZONE $6::text, 'YYYY-MM') AS mes_recibida,
            (q.id_estado_queja = ${ESTADO_RESUELTA} AND f.resuelta_en >= p.inicio AND f.resuelta_en < p.fin) AS resuelta_en_periodo,
            CASE WHEN q.id_estado_queja = ${ESTADO_RESUELTA} THEN to_char(f.resuelta_en AT TIME ZONE $6::text, 'YYYY-MM') END AS mes_resuelta,
            CASE WHEN q.id_estado_queja = ${ESTADO_RESUELTA}
                 THEN (EXTRACT(EPOCH FROM (f.resuelta_en - q.creado_en)) / 86400)::float8 END AS dias_resolucion
     FROM quejas q
     CROSS JOIN periodo p
     JOIN catalogos_categoria_queja cq ON cq.id_categoria_queja = q.id_categoria_queja
     LEFT JOIN departamentos d ON d.id_departamento = q.id_departamento
     LEFT JOIN sucursales su ON su.id_sucursal = q.id_sucursal
     LEFT JOIN LATERAL (
       SELECT h.fecha_cambio FROM historiales_estado_queja h
       WHERE h.id_queja = q.id_queja AND h.id_estado_queja = ${ESTADO_RESUELTA}
       ORDER BY h.fecha_cambio DESC
       LIMIT 1
     ) c ON TRUE
     CROSS JOIN LATERAL (SELECT COALESCE(c.fecha_cambio, q.actualizado_en) AS resuelta_en) f
     WHERE ($3::smallint IS NULL OR q.id_categoria_queja = $3)
       AND ($4::uuid IS NULL OR q.id_sucursal = $4)
       AND ($5::boolean IS FALSE OR q.id_sucursal IS NULL)
       AND ((q.creado_en >= p.inicio AND q.creado_en < p.fin)
         OR (q.id_estado_queja = ${ESTADO_RESUELTA} AND f.resuelta_en >= p.inicio AND f.resuelta_en < p.fin))`,
    [desde, hasta, idCategoria, idSucursal, sinSucursal, zonaHoraria],
  );
  return rows;
}

module.exports = { listarQuejasDelPeriodo };
