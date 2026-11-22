// Altas y bajas para los indicadores de rotación del dashboard de RRHH (KPI-12). El área es la del cargo actual
// y la sucursal la actual del colaborador: al darlo de baja ya no cambian, así que reflejan dónde estaba al irse.
const NOMBRE_COMPLETO = `concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido)`;

const COLUMNAS = `e.id_empleado,
            ${NOMBRE_COMPLETO} AS nombre_completo,
            to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
            to_char(e.fecha_baja, 'YYYY-MM-DD') AS fecha_baja,
            c.id_departamento,
            d.nombre AS area,
            e.id_sucursal_actual AS id_sucursal,
            s.nombre AS sucursal`;

const ORIGEN = `FROM empleados e
       JOIN cargos c        ON c.id_cargo = e.id_cargo_actual
       JOIN departamentos d ON d.id_departamento = c.id_departamento
       JOIN sucursales s    ON s.id_sucursal = e.id_sucursal_actual`;

const FILTRO_UBICACION = `($3::uuid IS NULL OR c.id_departamento = $3)
        AND ($4::uuid IS NULL OR e.id_sucursal_actual = $4)`;

// Colaboradores que ingresaron dentro del periodo [desde, hasta].
const listarIngresos = async (db, { desde, hasta, departamento, sucursal }) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}
       ${ORIGEN}
      WHERE e.fecha_ingreso BETWEEN $1::date AND $2::date
        AND ${FILTRO_UBICACION}
      ORDER BY e.fecha_ingreso, nombre_completo`,
    [desde, hasta, departamento, sucursal]
  );
  return rows;
};

// Colaboradores en BAJA cuyo último día trabajado cae dentro del periodo [desde, hasta].
const listarBajas = async (db, { desde, hasta, departamento, sucursal }) => {
  const { rows } = await db.query(
    `SELECT ${COLUMNAS}
       ${ORIGEN}
       JOIN estados_empleado ee ON ee.id_estado_empleado = e.id_estado_empleado
      WHERE ee.codigo = 'BAJA'
        AND e.fecha_baja BETWEEN $1::date AND $2::date
        AND ${FILTRO_UBICACION}
      ORDER BY e.fecha_baja, nombre_completo`,
    [desde, hasta, departamento, sucursal]
  );
  return rows;
};

module.exports = { listarIngresos, listarBajas };
