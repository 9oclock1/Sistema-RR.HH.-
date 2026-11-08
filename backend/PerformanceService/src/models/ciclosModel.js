const pool = require("../config/db");
const { ESTADO_EVALUACION } = require("../utils/evaluaciones");
const { ESTADO_VERSION } = require("../utils/catalogos");

async function obtenerVersion(idVersion, db = pool) {
  const { rows } = await db.query(
    `SELECT v.id_version, v.id_estado_version, v.numero_version,
            p.nombre AS plantilla, p.id_departamento_destino
     FROM versiones_plantilla v
     JOIN plantillas_evaluacion p ON p.id_plantilla = v.id_plantilla
     WHERE v.id_version = $1`,
    [idVersion],
  );
  return rows[0] ?? null;
}

async function obtenerPeriodo(idPeriodo, db = pool) {
  const { rows } = await db.query(
    "SELECT id_periodo, nombre, fecha_inicio, fecha_fin FROM periodos_evaluacion WHERE id_periodo = $1",
    [idPeriodo],
  );
  return rows[0] ?? null;
}

// Solo las versiones publicadas se pueden programar en un ciclo.
async function listarVersionesPublicadas(db = pool) {
  const { rows } = await db.query(
    `SELECT v.id_version, v.numero_version, v.publicada_en,
            p.id_plantilla, p.nombre AS plantilla, p.id_departamento_destino, d.nombre AS area,
            p.vigencia_desde, p.vigencia_hasta
     FROM versiones_plantilla v
     JOIN plantillas_evaluacion p ON p.id_plantilla = v.id_plantilla
     JOIN departamentos d ON d.id_departamento = p.id_departamento_destino
     WHERE v.id_estado_version = ${ESTADO_VERSION.PUBLICADA}
     ORDER BY p.nombre, v.numero_version DESC`,
  );
  return rows;
}

async function listarPeriodos(db = pool) {
  const { rows } = await db.query(
    "SELECT id_periodo, nombre, fecha_inicio, fecha_fin FROM periodos_evaluacion ORDER BY fecha_inicio DESC, nombre",
  );
  return rows;
}

// Réplicas mínimas de EmployeeDB: se crean o actualizan antes de usarlas.
async function replicarEmpleado(db, { id_empleado, nombres, apellidos }) {
  await db.query(
    `INSERT INTO empleados (id_empleado, nombres, apellidos) VALUES ($1, $2, $3)
     ON CONFLICT (id_empleado) DO UPDATE
       SET nombres = EXCLUDED.nombres, apellidos = EXCLUDED.apellidos, actualizado_en = CURRENT_TIMESTAMP`,
    [id_empleado, nombres, apellidos],
  );
}

async function replicarDepartamentos(db, departamentos) {
  if (departamentos.length === 0) return;
  await db.query(
    `INSERT INTO departamentos (id_departamento, nombre)
     SELECT t.id_departamento, t.nombre FROM unnest($1::uuid[], $2::text[]) AS t (id_departamento, nombre)
     ON CONFLICT (id_departamento) DO UPDATE SET nombre = EXCLUDED.nombre, actualizado_en = CURRENT_TIMESTAMP`,
    [departamentos.map((d) => d.id_departamento), departamentos.map((d) => d.nombre)],
  );
}

async function replicarSucursales(db, sucursales) {
  if (sucursales.length === 0) return;
  await db.query(
    `INSERT INTO sucursales (id_sucursal, nombre)
     SELECT t.id_sucursal, t.nombre FROM unnest($1::uuid[], $2::text[]) AS t (id_sucursal, nombre)
     ON CONFLICT (id_sucursal) DO UPDATE SET nombre = EXCLUDED.nombre, actualizado_en = CURRENT_TIMESTAMP`,
    [sucursales.map((s) => s.id_sucursal), sucursales.map((s) => s.nombre)],
  );
}

// El ciclo nace en estado PROGRAMADO (valor por defecto de la columna).
async function crearCiclo(db, { idVersion, idPeriodo, nombre, fechaInicio, fechaLimite }, idCreador) {
  const { rows } = await db.query(
    `INSERT INTO ciclos_evaluacion (id_version, id_periodo, id_empleado_creador, nombre, fecha_inicio, fecha_limite)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id_ciclo`,
    [idVersion, idPeriodo, idCreador, nombre, fechaInicio, fechaLimite],
  );
  return rows[0].id_ciclo;
}

// Una fila de EVALUACIONES por asignación; nacen PENDIENTE (valor por defecto de la columna).
async function insertarEvaluaciones(db, idCiclo, filas) {
  const { rowCount } = await db.query(
    `INSERT INTO evaluaciones (id_ciclo, id_empleado_evaluado, id_empleado_evaluador, id_departamento, id_sucursal)
     SELECT $1::uuid, t.evaluado, t.evaluador, t.departamento, t.sucursal
     FROM unnest($2::uuid[], $3::uuid[], $4::uuid[], $5::uuid[]) AS t (evaluado, evaluador, departamento, sucursal)`,
    [
      idCiclo,
      filas.map((f) => f.idEvaluado),
      filas.map((f) => f.idEvaluador),
      filas.map((f) => f.idDepartamento),
      filas.map((f) => f.idSucursal),
    ],
  );
  return rowCount;
}

// Ciclos con el conteo de sus evaluaciones por estado; con idCiclo devuelve solo ese.
async function listarCiclos(idCiclo = null, db = pool) {
  const { rows } = await db.query(
    `SELECT c.id_ciclo, c.nombre, c.fecha_inicio, c.fecha_limite, c.cerrado_en, c.creado_en,
            ec.codigo AS estado_codigo, ec.nombre AS estado_nombre,
            pe.id_periodo, pe.nombre AS periodo,
            v.id_version, v.numero_version, pl.nombre AS plantilla,
            count(e.id_evaluacion)::int AS total,
            (count(*) FILTER (WHERE e.id_estado_evaluacion = ${ESTADO_EVALUACION.PENDIENTE}))::int AS pendientes,
            (count(*) FILTER (WHERE e.id_estado_evaluacion = ${ESTADO_EVALUACION.BORRADOR}))::int AS en_borrador,
            (count(*) FILTER (WHERE e.id_estado_evaluacion = ${ESTADO_EVALUACION.ENVIADA}))::int AS enviadas,
            (count(*) FILTER (WHERE e.id_estado_evaluacion = ${ESTADO_EVALUACION.VENCIDA}))::int AS vencidas
     FROM ciclos_evaluacion c
     JOIN catalogos_estado_ciclo ec ON ec.id_estado_ciclo = c.id_estado_ciclo
     JOIN periodos_evaluacion pe ON pe.id_periodo = c.id_periodo
     JOIN versiones_plantilla v ON v.id_version = c.id_version
     JOIN plantillas_evaluacion pl ON pl.id_plantilla = v.id_plantilla
     LEFT JOIN evaluaciones e ON e.id_ciclo = c.id_ciclo
     WHERE $1::uuid IS NULL OR c.id_ciclo = $1
     GROUP BY c.id_ciclo, ec.codigo, ec.nombre, pe.id_periodo, pe.nombre, v.id_version, v.numero_version, pl.nombre
     ORDER BY c.fecha_limite DESC, c.nombre`,
    [idCiclo],
  );
  return rows;
}

async function listarAsignaciones(idCiclo, db = pool) {
  const { rows } = await db.query(
    `SELECT e.id_evaluacion, e.id_empleado_evaluado, ed.nombres AS evaluado_nombres, ed.apellidos AS evaluado_apellidos,
            e.id_empleado_evaluador, er.nombres AS evaluador_nombres, er.apellidos AS evaluador_apellidos,
            de.nombre AS area, su.nombre AS sucursal,
            ce.codigo AS estado_codigo, ce.nombre AS estado_nombre,
            e.recordatorio_enviado_en, e.enviada_en
     FROM evaluaciones e
     JOIN empleados ed ON ed.id_empleado = e.id_empleado_evaluado
     JOIN empleados er ON er.id_empleado = e.id_empleado_evaluador
     JOIN departamentos de ON de.id_departamento = e.id_departamento
     JOIN sucursales su ON su.id_sucursal = e.id_sucursal
     JOIN catalogos_estado_evaluacion ce ON ce.id_estado_evaluacion = e.id_estado_evaluacion
     WHERE e.id_ciclo = $1
     ORDER BY ed.apellidos, ed.nombres`,
    [idCiclo],
  );
  return rows;
}

module.exports = {
  obtenerVersion,
  obtenerPeriodo,
  listarVersionesPublicadas,
  listarPeriodos,
  replicarEmpleado,
  replicarDepartamentos,
  replicarSucursales,
  crearCiclo,
  insertarEvaluaciones,
  listarCiclos,
  listarAsignaciones,
};
