const NOMBRE_COMPLETO = `concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido)`;

const SELECT_PLAN = `
  SELECT p.id_plan,
         p.estado,
         p.observaciones,
         p.asignado_por,
         p.asignado_en,
         p.formalizado_en,
         p.formalizado_por,
         p.cursos_pendientes_al_formalizar,
         e.id_empleado,
         ${NOMBRE_COMPLETO} AS nombre_completo,
         e.numero_documento,
         ee.permite_acceso AS empleado_activo,
         ca.id_cargo AS id_cargo_actual,
         ca.nombre AS cargo_actual,
         s.id_sucursal AS id_sucursal_actual,
         s.nombre AS sucursal_actual,
         cd.id_cargo AS id_cargo_destino,
         cd.nombre AS cargo_destino,
         dd.nombre AS area_destino
    FROM planes_ascenso p
    JOIN empleados e         ON e.id_empleado = p.id_empleado
    JOIN estados_empleado ee ON ee.id_estado_empleado = e.id_estado_empleado
    JOIN cargos ca           ON ca.id_cargo = e.id_cargo_actual
    JOIN sucursales s        ON s.id_sucursal = e.id_sucursal_actual
    JOIN cargos cd           ON cd.id_cargo = p.id_cargo_destino
    JOIN departamentos dd    ON dd.id_departamento = cd.id_departamento`;

const listar = async (db, { estado }) => {
  const { rows } = await db.query(
    `${SELECT_PLAN}
      WHERE ($1::text = 'TODOS' OR p.estado = $1::text)
      ORDER BY p.estado, nombre_completo`,
    [estado]
  );
  return rows;
};

const obtener = async (db, idPlan) => {
  const { rows } = await db.query(`${SELECT_PLAN} WHERE p.id_plan = $1`, [idPlan]);
  return rows[0] ?? null;
};

const bloquear = async (db, idPlan) => {
  const { rows } = await db.query('SELECT id_plan, estado FROM planes_ascenso WHERE id_plan = $1 FOR UPDATE', [idPlan]);
  return rows[0] ?? null;
};

// Cursos requeridos por el cargo destino de cada plan, con el certificado más reciente del empleado en el Kardex.
const listarCursos = async (db, idsPlan) => {
  if (idsPlan.length === 0) return { hoy: null, filas: [] };
  const { rows } = await db.query(
    `SELECT p.id_plan,
            cu.id_curso, cu.codigo, cu.nombre, cu.horas_academicas,
            r.es_obligatorio, r.meses_validez_requerida,
            cert.id_capacitacion, cert.institucion_emisora,
            to_char(cert.fecha_emision, 'YYYY-MM-DD') AS fecha_emision,
            to_char(cert.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento
       FROM planes_ascenso p
       JOIN requisitos_capacitacion_cargo r ON r.id_cargo = p.id_cargo_destino
       JOIN cursos_capacitacion cu          ON cu.id_curso = r.id_curso
       LEFT JOIN LATERAL (
         SELECT c.id_capacitacion, c.institucion_emisora, c.fecha_emision, c.fecha_vencimiento
           FROM capacitaciones_certificacion c
          WHERE c.id_empleado = p.id_empleado AND c.id_curso = r.id_curso
          ORDER BY c.fecha_emision DESC
          LIMIT 1
       ) cert ON TRUE
      WHERE p.id_plan = ANY($1::uuid[])
      ORDER BY p.id_plan, r.es_obligatorio DESC, cu.nombre`,
    [idsPlan]
  );
  const { rows: fecha } = await db.query(`SELECT to_char(CURRENT_DATE, 'YYYY-MM-DD') AS hoy`);
  return { hoy: fecha[0].hoy, filas: rows };
};

const obtenerEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT e.id_empleado, ${NOMBRE_COMPLETO} AS nombre_completo, e.id_cargo_actual, ee.permite_acceso AS activo
       FROM empleados e
       JOIN estados_empleado ee ON ee.id_estado_empleado = e.id_estado_empleado
      WHERE e.id_empleado = $1`,
    [idEmpleado]
  );
  return rows[0] ?? null;
};

const obtenerCargo = async (db, idCargo) => {
  const { rows } = await db.query(
    `SELECT c.id_cargo, c.nombre, c.esta_activo,
            (SELECT count(*)::int FROM requisitos_capacitacion_cargo r WHERE r.id_cargo = c.id_cargo) AS cursos_requeridos
       FROM cargos c
      WHERE c.id_cargo = $1`,
    [idCargo]
  );
  return rows[0] ?? null;
};

const obtenerPlanEnCurso = async (db, idEmpleado) => {
  const { rows } = await db.query(
    "SELECT id_plan FROM planes_ascenso WHERE id_empleado = $1 AND estado = 'EN_CURSO'",
    [idEmpleado]
  );
  return rows[0] ?? null;
};

const insertar = async (db, plan) => {
  await db.query(
    `INSERT INTO planes_ascenso (id_plan, id_empleado, id_cargo_destino, observaciones, asignado_por)
     VALUES ($1, $2, $3, $4, $5)`,
    [plan.id_plan, plan.id_empleado, plan.id_cargo_destino, plan.observaciones, plan.asignado_por]
  );
};

const marcarFormalizado = async (db, idPlan, { formalizadoPor, pendientes }) => {
  await db.query(
    `UPDATE planes_ascenso
        SET estado = 'FORMALIZADO',
            formalizado_en = CURRENT_TIMESTAMP,
            formalizado_por = $2,
            cursos_pendientes_al_formalizar = $3
      WHERE id_plan = $1`,
    [idPlan, formalizadoPor, pendientes]
  );
};

module.exports = {
  listar,
  obtener,
  bloquear,
  listarCursos,
  obtenerEmpleado,
  obtenerCargo,
  obtenerPlanEnCurso,
  insertar,
  marcarFormalizado,
};
