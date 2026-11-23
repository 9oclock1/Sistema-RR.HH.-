const NOMBRE_COMPLETO = `concat_ws(' ', e.nombres, e.primer_apellido, e.segundo_apellido)`;

const SELECT_POSTULACION = `
  SELECT p.id_postulacion,
         p.id_convocatoria,
         p.id_empleado,
         ${NOMBRE_COMPLETO} AS nombre_completo,
         e.numero_documento,
         to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso,
         c.nombre AS cargo_actual,
         s.nombre AS sucursal_actual,
         p.fecha_postulacion,
         to_char(p.fecha_postulacion AT TIME ZONE 'America/La_Paz', 'YYYY-MM-DD') AS dia_postulacion,
         p.estado_postulacion,
         p.meses_permanencia,
         p.cumple_antiguedad,
         p.nota_ultima_evaluacion,
         p.ciclo_ultima_evaluacion,
         p.cumple_nota_evaluacion,
         p.puntaje_meritos,
         p.motivos_no_apto,
         p.validada_en,
         p.error_validacion
    FROM postulaciones_ascenso p
    JOIN empleados e  ON e.id_empleado = p.id_empleado
    JOIN cargos c     ON c.id_cargo = e.id_cargo_actual
    JOIN sucursales s ON s.id_sucursal = e.id_sucursal_actual`;

const aNumero = (valor) => (valor === null || valor === undefined ? null : Number(valor));

const aPostulacion = (fila) =>
  fila && {
    ...fila,
    nota_ultima_evaluacion: aNumero(fila.nota_ultima_evaluacion),
    puntaje_meritos: aNumero(fila.puntaje_meritos),
    motivos_no_apto: fila.motivos_no_apto ?? null,
  };

const obtener = async (db, idPostulacion) => {
  const { rows } = await db.query(`${SELECT_POSTULACION} WHERE p.id_postulacion = $1`, [idPostulacion]);
  return aPostulacion(rows[0]);
};

const obtenerDeEmpleado = async (db, idConvocatoria, idEmpleado) => {
  const { rows } = await db.query(`${SELECT_POSTULACION} WHERE p.id_convocatoria = $1 AND p.id_empleado = $2`, [
    idConvocatoria,
    idEmpleado,
  ]);
  return aPostulacion(rows[0]);
};

const listarDeConvocatoria = async (db, idConvocatoria) => {
  const { rows } = await db.query(`${SELECT_POSTULACION} WHERE p.id_convocatoria = $1 ORDER BY p.fecha_postulacion`, [
    idConvocatoria,
  ]);
  return rows.map(aPostulacion);
};

// Postulaciones de un empleado en varias convocatorias (para marcar en su portal a cuáles ya se postuló).
const listarDeEmpleado = async (db, idEmpleado, idsConvocatoria) => {
  if (idsConvocatoria.length === 0) return [];
  const { rows } = await db.query(`${SELECT_POSTULACION} WHERE p.id_empleado = $1 AND p.id_convocatoria = ANY($2::uuid[])`, [
    idEmpleado,
    idsConvocatoria,
  ]);
  return rows.map(aPostulacion);
};

const obtenerEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT e.id_empleado, ${NOMBRE_COMPLETO} AS nombre_completo, e.id_cargo_actual,
            to_char(e.fecha_ingreso, 'YYYY-MM-DD') AS fecha_ingreso, ee.permite_acceso AS activo
       FROM empleados e
       JOIN estados_empleado ee ON ee.id_estado_empleado = e.id_estado_empleado
      WHERE e.id_empleado = $1`,
    [idEmpleado]
  );
  return rows[0] ?? null;
};

const insertar = async (db, { id_postulacion: idPostulacion, id_convocatoria: idConvocatoria, id_empleado: idEmpleado }) => {
  await db.query('INSERT INTO postulaciones_ascenso (id_postulacion, id_convocatoria, id_empleado) VALUES ($1, $2, $3)', [
    idPostulacion,
    idConvocatoria,
    idEmpleado,
  ]);
};

const guardarValidacion = async (db, idPostulacion, resultado) => {
  await db.query(
    `UPDATE postulaciones_ascenso
        SET estado_postulacion = $2,
            meses_permanencia = $3,
            cumple_antiguedad = $4,
            nota_ultima_evaluacion = $5,
            ciclo_ultima_evaluacion = $6,
            cumple_nota_evaluacion = $7,
            puntaje_meritos = $8,
            motivos_no_apto = $9::text[],
            validada_en = CURRENT_TIMESTAMP,
            error_validacion = NULL
      WHERE id_postulacion = $1`,
    [
      idPostulacion,
      resultado.estado,
      resultado.meses_permanencia,
      resultado.cumple_antiguedad,
      resultado.nota_ultima_evaluacion,
      resultado.ciclo_ultima_evaluacion,
      resultado.cumple_nota_evaluacion,
      resultado.puntaje_meritos,
      resultado.motivos_no_apto,
    ]
  );
};

const registrarErrorValidacion = async (db, idPostulacion, mensaje) => {
  await db.query(
    `UPDATE postulaciones_ascenso
        SET estado_postulacion = 'PENDIENTE_VALIDACION', validada_en = NULL, error_validacion = $2
      WHERE id_postulacion = $1`,
    [idPostulacion, String(mensaje).slice(0, 300)]
  );
};

module.exports = {
  obtener,
  obtenerDeEmpleado,
  listarDeConvocatoria,
  listarDeEmpleado,
  obtenerEmpleado,
  insertar,
  guardarValidacion,
  registrarErrorValidacion,
};
