// src/models/organigrama.model.js
const pool = require('../../db/pool');

// Un registro por cargo activo; los empleados que lo ocupan (por cargo actual) vienen agregados.
async function obtenerCargosConOcupantes() {
  const { rows } = await pool.query(
    `SELECT
       c.id_cargo,
       c.codigo,
       c.nombre AS cargo,
       c.id_cargo_jefe_directo AS id_cargo_superior,
       d.nombre AS departamento,
       COALESCE(
         json_agg(
           json_build_object(
             'id_empleado', e.id_empleado,
             'nombre', concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido),
             'sucursal', s.nombre
           ) ORDER BY e.primer_apellido, e.nombres
         ) FILTER (WHERE e.id_empleado IS NOT NULL),
         '[]'::json
       ) AS empleados
     FROM cargos c
     JOIN departamentos d ON d.id_departamento = c.id_departamento
     LEFT JOIN empleados e
            ON e.id_cargo_actual = c.id_cargo
           AND e.id_estado_empleado NOT IN (
                 SELECT id_estado_empleado FROM estados_empleado WHERE UPPER(codigo) = 'BAJA'
               )
     LEFT JOIN sucursales s ON s.id_sucursal = e.id_sucursal_actual
     WHERE c.esta_activo = TRUE
     GROUP BY c.id_cargo, d.id_departamento
     ORDER BY c.nombre;`
  );
  return rows;
}

module.exports = { obtenerCargosConOcupantes };