// KAN-84: formalización del ascenso del postulante apto de una convocatoria interna.
const MAX_ERROR = 300;
const recortar = (texto) => String(texto ?? 'Error desconocido').slice(0, MAX_ERROR);

const bloquearConvocatoria = async (db, idConvocatoria) => {
  const { rows } = await db.query(
    `SELECT id_convocatoria, id_cargo, id_sucursal, titulo, esta_abierta
       FROM convocatorias_ascenso
      WHERE id_convocatoria = $1
        FOR UPDATE`,
    [idConvocatoria]
  );
  return rows[0] ?? null;
};

const bloquearPostulacion = async (db, idPostulacion) => {
  const { rows } = await db.query(
    `SELECT id_postulacion, id_convocatoria, id_empleado, estado_postulacion, estado_ascenso,
            to_char(fecha_vigencia_ascenso, 'YYYY-MM-DD') AS fecha_vigencia_ascenso
       FROM postulaciones_ascenso
      WHERE id_postulacion = $1
        FOR UPDATE`,
    [idPostulacion]
  );
  return rows[0] ?? null;
};

const obtenerFormalizadaDeConvocatoria = async (db, idConvocatoria) => {
  const { rows } = await db.query(
    `SELECT id_postulacion FROM postulaciones_ascenso WHERE id_convocatoria = $1 AND formalizado_en IS NOT NULL`,
    [idConvocatoria]
  );
  return rows[0] ?? null;
};

// Un ascenso ya formalizado que todavía no entra en vigencia (de esta u otra convocatoria).
const obtenerProgramadoDeEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT p.id_postulacion, to_char(p.fecha_vigencia_ascenso, 'YYYY-MM-DD') AS fecha_vigencia, c.nombre AS cargo
       FROM postulaciones_ascenso p
       JOIN convocatorias_ascenso cv ON cv.id_convocatoria = p.id_convocatoria
       JOIN cargos c ON c.id_cargo = cv.id_cargo
      WHERE p.id_empleado = $1 AND p.estado_ascenso = 'PROGRAMADO'
      LIMIT 1`,
    [idEmpleado]
  );
  return rows[0] ?? null;
};

// Nivel salarial y jerárquico van con el cargo: nivel_salarial y el cargo del jefe directo.
const obtenerCargo = async (db, idCargo) => {
  const { rows } = await db.query(
    `SELECT c.id_cargo, c.nombre, c.nivel_salarial, c.salario_base_referencial, c.esta_activo,
            c.id_cargo_jefe_directo, j.nombre AS cargo_jefe_directo
       FROM cargos c
       LEFT JOIN cargos j ON j.id_cargo = c.id_cargo_jefe_directo
      WHERE c.id_cargo = $1`,
    [idCargo]
  );
  const fila = rows[0];
  return fila ? { ...fila, salario_base_referencial: Number(fila.salario_base_referencial) } : null;
};

const obtenerEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT e.id_empleado, e.nombres,
            concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido) AS nombre_completo,
            e.id_cargo_actual, c.nombre AS cargo_actual, e.id_sucursal_actual,
            ee.permite_acceso AS activo
       FROM empleados e
       JOIN estados_empleado ee ON ee.id_estado_empleado = e.id_estado_empleado
       JOIN cargos c ON c.id_cargo = e.id_cargo_actual
      WHERE e.id_empleado = $1`,
    [idEmpleado]
  );
  return rows[0] ?? null;
};

const registrarFormalizacion = async (db, idPostulacion, datos) => {
  await db.query(
    `UPDATE postulaciones_ascenso
        SET estado_ascenso = $2,
            fecha_formalizacion_ascenso = CURRENT_DATE,
            fecha_vigencia_ascenso = $3,
            haber_ascenso = $4,
            id_contrato_ascenso = $5,
            observaciones_resolucion = $6,
            formalizado_por = $7,
            formalizado_en = CURRENT_TIMESTAMP,
            ascenso_aplicado_en = CASE WHEN $8::boolean THEN CURRENT_TIMESTAMP END
      WHERE id_postulacion = $1`,
    [
      idPostulacion,
      datos.estado,
      datos.fecha_vigencia,
      datos.haber_mensual_pactado,
      datos.id_contrato,
      datos.observaciones,
      datos.formalizado_por,
      datos.estado === 'APLICADO',
    ]
  );
};

// La convocatoria cubrió su vacante: deja de aceptar postulaciones aunque su fecha de cierre no haya llegado.
const cerrarConvocatoria = async (db, idConvocatoria) => {
  await db.query(
    `UPDATE convocatorias_ascenso
        SET esta_abierta = FALSE, cerrada_en = COALESCE(cerrada_en, CURRENT_TIMESTAMP)
      WHERE id_convocatoria = $1`,
    [idConvocatoria]
  );
};

const listarProgramadosVencidos = async (db) => {
  const { rows } = await db.query(
    `SELECT id_postulacion
       FROM postulaciones_ascenso
      WHERE estado_ascenso = 'PROGRAMADO' AND fecha_vigencia_ascenso <= CURRENT_DATE
      ORDER BY fecha_vigencia_ascenso, formalizado_en`
  );
  return rows.map((fila) => fila.id_postulacion);
};

const marcarAplicado = async (db, idPostulacion) => {
  await db.query(
    `UPDATE postulaciones_ascenso
        SET estado_ascenso = 'APLICADO', ascenso_aplicado_en = CURRENT_TIMESTAMP, error_aplicacion_ascenso = NULL
      WHERE id_postulacion = $1`,
    [idPostulacion]
  );
};

const registrarErrorAplicacion = async (db, idPostulacion, mensaje) => {
  await db.query(
    `UPDATE postulaciones_ascenso SET error_aplicacion_ascenso = $2
      WHERE id_postulacion = $1 AND estado_ascenso = 'PROGRAMADO'`,
    [idPostulacion, recortar(mensaje)]
  );
};

const registrarNotificacion = async (db, idPostulacion, { entregada, error }) => {
  await db.query(
    entregada
      ? `UPDATE postulaciones_ascenso
            SET ascenso_notificado_en = CURRENT_TIMESTAMP, error_notificacion_ascenso = NULL
          WHERE id_postulacion = $1`
      : `UPDATE postulaciones_ascenso SET error_notificacion_ascenso = $2 WHERE id_postulacion = $1`,
    entregada ? [idPostulacion] : [idPostulacion, recortar(error)]
  );
};

module.exports = {
  bloquearConvocatoria,
  bloquearPostulacion,
  obtenerFormalizadaDeConvocatoria,
  obtenerProgramadoDeEmpleado,
  obtenerCargo,
  obtenerEmpleado,
  registrarFormalizacion,
  cerrarConvocatoria,
  listarProgramadosVencidos,
  marcarAplicado,
  registrarErrorAplicacion,
  registrarNotificacion,
};
