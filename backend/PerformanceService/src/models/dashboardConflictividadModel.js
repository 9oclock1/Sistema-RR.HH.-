const pool = require("../config/db");

// RF-72 (KAN-506): quejas recibidas en el periodo, por área y sucursal. A diferencia del dashboard de
// resolución (dashboardQuejasModel), aquí solo importa cuándo se recibió la queja, no cuándo se resolvió.
async function contarQuejasPorAreaYSucursal({ desde, hasta, idSucursal, idDepartamento, zonaHoraria }, db = pool) {
  const { rows } = await db.query(
    `WITH periodo AS (
       SELECT ($1::date)::timestamp AT TIME ZONE $5::text AS inicio,
              ($2::date + 1)::timestamp AT TIME ZONE $5::text AS fin
     )
     SELECT q.id_departamento, d.nombre AS departamento, q.id_sucursal, su.nombre AS sucursal,
            COUNT(*)::int AS quejas
     FROM quejas q
     CROSS JOIN periodo p
     LEFT JOIN departamentos d ON d.id_departamento = q.id_departamento
     LEFT JOIN sucursales su ON su.id_sucursal = q.id_sucursal
     WHERE q.creado_en >= p.inicio AND q.creado_en < p.fin
       AND ($3::uuid IS NULL OR q.id_sucursal = $3)
       AND ($4::uuid IS NULL OR q.id_departamento = $4)
     GROUP BY q.id_departamento, d.nombre, q.id_sucursal, su.nombre`,
    [desde, hasta, idSucursal, idDepartamento, zonaHoraria],
  );
  return rows;
}

module.exports = { contarQuejasPorAreaYSucursal };
