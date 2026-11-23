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
         p.error_validacion,
         p.estado_ascenso,
         to_char(p.fecha_formalizacion_ascenso, 'YYYY-MM-DD') AS fecha_formalizacion_ascenso,
         to_char(p.fecha_vigencia_ascenso, 'YYYY-MM-DD') AS fecha_vigencia_ascenso,
         p.haber_ascenso,
         p.id_contrato_ascenso,
         ka.numero_contrato AS numero_contrato_ascenso,
         p.observaciones_resolucion,
         p.formalizado_por,
         p.formalizado_en,
         p.ascenso_aplicado_en,
         p.error_aplicacion_ascenso,
         p.ascenso_notificado_en,
         p.error_notificacion_ascenso
    FROM postulaciones_ascenso p
    LEFT JOIN contratos ka ON ka.id_contrato = p.id_contrato_ascenso
    JOIN empleados e  ON e.id_empleado = p.id_empleado
    JOIN cargos c     ON c.id_cargo = e.id_cargo_actual
    JOIN sucursales s ON s.id_sucursal = e.id_sucursal_actual`;

const aNumero = (valor) => (valor === null || valor === undefined ? null : Number(valor));

// KAN-84: los datos de la formalización van agrupados en `ascenso` (null mientras no se formalice).
const aAscenso = (fila) =>
  fila.estado_ascenso === null
    ? null
    : {
        estado: fila.estado_ascenso,
        fecha_formalizacion: fila.fecha_formalizacion_ascenso,
        fecha_vigencia: fila.fecha_vigencia_ascenso,
        haber_mensual_pactado: aNumero(fila.haber_ascenso),
        id_contrato: fila.id_contrato_ascenso,
        numero_contrato: fila.numero_contrato_ascenso,
        observaciones: fila.observaciones_resolucion,
        formalizado_por: fila.formalizado_por,
        formalizado_en: fila.formalizado_en,
        aplicado_en: fila.ascenso_aplicado_en,
        error_aplicacion: fila.error_aplicacion_ascenso,
        notificado_en: fila.ascenso_notificado_en,
        error_notificacion: fila.error_notificacion_ascenso,
      };

const CAMPOS_ASCENSO = [
  'estado_ascenso',
  'fecha_formalizacion_ascenso',
  'fecha_vigencia_ascenso',
  'haber_ascenso',
  'id_contrato_ascenso',
  'numero_contrato_ascenso',
  'observaciones_resolucion',
  'formalizado_por',
  'formalizado_en',
  'ascenso_aplicado_en',
  'error_aplicacion_ascenso',
  'ascenso_notificado_en',
  'error_notificacion_ascenso',
];

const aPostulacion = (fila) => {
  if (!fila) return fila;
  const postulacion = {
    ...fila,
    nota_ultima_evaluacion: aNumero(fila.nota_ultima_evaluacion),
    puntaje_meritos: aNumero(fila.puntaje_meritos),
    motivos_no_apto: fila.motivos_no_apto ?? null,
    ascenso: aAscenso(fila),
  };
  for (const campo of CAMPOS_ASCENSO) delete postulacion[campo];
  return postulacion;
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
