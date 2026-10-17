const pool = require("../config/db");

const HOY_BOLIVIA = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/La_Paz')::date";

// Entradas y salidas de las jornadas del rango. `ids` NULL incluye a todos los empleados.
async function listarMarcajes(desde, hasta, ids = null) {
  const { rows } = await pool.query(
    `SELECT m.id_marcaje, m.id_empleado, m.fecha_jornada, m.fecha_hora_marcaje, t.codigo AS tipo_codigo
     FROM marcajes m
     JOIN catalogos_tipo_marcaje t USING (id_tipo_marcaje)
     WHERE m.fecha_jornada BETWEEN $1 AND $2 AND ($3::uuid[] IS NULL OR m.id_empleado = ANY($3::uuid[]))
     ORDER BY m.id_empleado, m.fecha_jornada, m.fecha_hora_marcaje`,
    [desde, hasta, ids]
  );
  return rows;
}

async function listarFeriados(desde, hasta) {
  const { rows } = await pool.query("SELECT fecha, nombre FROM feriados WHERE fecha BETWEEN $1 AND $2 ORDER BY fecha", [
    desde,
    hasta,
  ]);
  return rows;
}

const COLUMNAS_CALCULO = [
  ["id_empleado", "uuid"],
  ["fecha_jornada", "date"],
  ["id_turno", "uuid"],
  ["id_rol", "uuid"],
  ["nombre_turno", "varchar"],
  ["inicio_programado", "timestamptz"],
  ["fin_programado", "timestamptz"],
  ["minutos_refrigerio", "smallint"],
  ["id_marcaje_entrada", "uuid"],
  ["id_marcaje_salida", "uuid"],
  ["entrada_en", "timestamptz"],
  ["salida_en", "timestamptz"],
  ["es_feriado", "boolean"],
  ["minutos_trabajados", "int"],
  ["minutos_ordinarios", "int"],
  ["minutos_ordinarios_nocturnos", "int"],
  ["minutos_extra", "int"],
  ["minutos_anticipados", "int"],
  ["id_estado_horas_extra", "smallint"],
  ["minutos_extra_aprobados", "int"],
  ["minutos_extra_simples", "int"],
  ["minutos_extra_dobles", "int"],
  ["minutos_extra_nocturnos", "int"],
  ["minutos_feriado", "int"],
  ["minutos_nocturnos", "int"],
];
const ACTUALIZABLES = COLUMNAS_CALCULO.map(([c]) => c).filter((c) => c !== "id_empleado" && c !== "fecha_jornada");

// Guarda el cálculo de cada jornada. Una jornada ya consolidada no se toca; las demás se actualizan solo si cambió algo.
async function guardarCalculos(filas) {
  if (filas.length === 0) return 0;
  const nombres = COLUMNAS_CALCULO.map(([c]) => c);
  const { rowCount } = await pool.query(
    `INSERT INTO horas_jornada (${nombres.join(", ")})
     SELECT * FROM unnest(${COLUMNAS_CALCULO.map(([, tipo], i) => `$${i + 1}::${tipo}[]`).join(", ")})
     ON CONFLICT (id_empleado, fecha_jornada) DO UPDATE SET
       ${ACTUALIZABLES.map((c) => `${c} = EXCLUDED.${c}`).join(",\n       ")},
       calculada_en = CURRENT_TIMESTAMP
     WHERE horas_jornada.id_periodo IS NULL
       AND (${ACTUALIZABLES.map((c) => `horas_jornada.${c}`).join(", ")})
           IS DISTINCT FROM (${ACTUALIZABLES.map((c) => `EXCLUDED.${c}`).join(", ")})`,
    nombres.map((c) => filas.map((f) => f[c] ?? null))
  );
  return rowCount;
}

const conCatalogos = `
  SELECT h.*, e.codigo AS estado_codigo, e.nombre AS estado_nombre, f.nombre AS nombre_feriado
  FROM horas_jornada h
  JOIN catalogos_estado_horas_extra e USING (id_estado_horas_extra)
  LEFT JOIN feriados f ON f.fecha = h.fecha_jornada`;

// Jornadas calculadas de los empleados en el rango; `estados` NULL incluye todas.
async function listar(ids, desde, hasta, estados = null) {
  const { rows } = await pool.query(
    `${conCatalogos}
     WHERE h.id_empleado = ANY($1::uuid[]) AND h.fecha_jornada BETWEEN $2 AND $3
       AND ($4::smallint[] IS NULL OR h.id_estado_horas_extra = ANY($4::smallint[]))
     ORDER BY h.fecha_jornada DESC, h.entrada_en DESC`,
    [ids, desde, hasta, estados]
  );
  return rows;
}

// Totales por empleado del rango. `ids` NULL incluye a todos.
async function totalizar(db, desde, hasta, ids = null) {
  const { rows } = await db.query(
    `SELECT id_empleado,
            COUNT(*)::int AS jornadas,
            SUM(minutos_trabajados)::int AS minutos_trabajados,
            SUM(minutos_ordinarios)::int AS minutos_ordinarios,
            SUM(minutos_nocturnos)::int AS minutos_nocturnos,
            SUM(minutos_extra)::int AS minutos_extra,
            SUM(minutos_anticipados)::int AS minutos_anticipados,
            COALESCE(SUM(minutos_extra_aprobados), 0)::int AS minutos_extra_aprobados,
            SUM(minutos_extra_simples)::int AS minutos_extra_simples,
            SUM(minutos_extra_dobles)::int AS minutos_extra_dobles,
            SUM(minutos_extra_nocturnos)::int AS minutos_extra_nocturnos,
            SUM(minutos_feriado)::int AS minutos_feriado,
            COUNT(*) FILTER (WHERE id_estado_horas_extra = 2)::int AS pendientes
     FROM horas_jornada
     WHERE fecha_jornada BETWEEN $1 AND $2 AND ($3::uuid[] IS NULL OR id_empleado = ANY($3::uuid[]))
     GROUP BY id_empleado`,
    [desde, hasta, ids]
  );
  return rows;
}

async function contarPendientes(db, desde, hasta) {
  const { rows } = await db.query(
    `SELECT COUNT(*)::int AS cantidad FROM horas_jornada
     WHERE fecha_jornada BETWEEN $1 AND $2 AND id_estado_horas_extra = 2`,
    [desde, hasta]
  );
  return rows[0].cantidad;
}

async function crearPeriodo(cliente, { desde, hasta, idResponsable, nombreResponsable }) {
  const { rows } = await cliente.query(
    `INSERT INTO periodos_horas_extra (fecha_inicio, fecha_fin, id_responsable, nombre_responsable)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [desde, hasta, idResponsable, nombreResponsable]
  );
  return rows[0];
}

// Asigna al periodo las jornadas de sus días y guarda cuántas fueron.
async function cerrarJornadas(cliente, periodo) {
  const { rowCount } = await cliente.query(
    "UPDATE horas_jornada SET id_periodo = $1 WHERE fecha_jornada BETWEEN $2 AND $3 AND id_periodo IS NULL",
    [periodo.id_periodo, periodo.fecha_inicio, periodo.fecha_fin]
  );
  const { rows } = await cliente.query(
    "UPDATE periodos_horas_extra SET cantidad_jornadas = $2 WHERE id_periodo = $1 RETURNING *",
    [periodo.id_periodo, rowCount]
  );
  return rows[0];
}

async function listarPeriodos() {
  const { rows } = await pool.query("SELECT * FROM periodos_horas_extra ORDER BY fecha_inicio DESC LIMIT 24");
  return rows;
}

async function momentoActual() {
  const { rows } = await pool.query(`SELECT CURRENT_TIMESTAMP AS ahora, ${HOY_BOLIVIA} AS hoy`);
  return rows[0];
}

module.exports = {
  listarMarcajes,
  listarFeriados,
  guardarCalculos,
  listar,
  totalizar,
  contarPendientes,
  crearPeriodo,
  cerrarJornadas,
  listarPeriodos,
  momentoActual,
};
