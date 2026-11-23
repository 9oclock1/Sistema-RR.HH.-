const ESTADO_NOTIFICACION = { PENDIENTE: 'PENDIENTE', ENTREGADA: 'ENTREGADA', FALLIDA: 'FALLIDA' };
const MAX_ERROR_NOTIFICACION = 300;

const SELECT_CONVOCATORIA = `
  SELECT
    cv.id_convocatoria,
    cv.id_cargo,
    c.codigo AS cargo_codigo,
    c.nombre AS cargo,
    c.nivel_salarial,
    c.id_departamento,
    d.nombre AS departamento,
    cv.id_sucursal,
    s.nombre AS sucursal,
    cv.titulo,
    cv.descripcion_requisitos,
    cv.meses_antiguedad_minima,
    cv.nota_minima_desempeno,
    cv.fecha_inicio_postulacion,
    cv.fecha_cierre_postulacion,
    cv.esta_abierta,
    cv.publicada_en,
    cv.cerrada_en,
    cv.id_empleado_publicador,
    cv.estado_notificacion,
    cv.destinatarios_notificados,
    cv.notificada_en,
    cv.ultimo_error_notificacion,
    CASE
      WHEN NOT cv.esta_abierta OR cv.fecha_cierre_postulacion < CURRENT_DATE THEN 'CERRADA'
      WHEN cv.fecha_inicio_postulacion > CURRENT_DATE THEN 'PROGRAMADA'
      ELSE 'ABIERTA'
    END AS estado,
    (cv.fecha_cierre_postulacion - CURRENT_DATE) AS dias_para_cierre
  FROM convocatorias_ascenso cv
  JOIN cargos c ON c.id_cargo = cv.id_cargo
  JOIN departamentos d ON d.id_departamento = c.id_departamento
  JOIN sucursales s ON s.id_sucursal = cv.id_sucursal
`;

const aConvocatoria = ({ nota_minima_desempeno: nota, dias_para_cierre: dias, ...fila }) => ({
  ...fila,
  nota_minima_desempeno: Number(nota),
  acepta_postulaciones: fila.estado === 'ABIERTA',
  dias_para_cierre: fila.estado === 'CERRADA' ? null : Number(dias),
});

const listar = async (db, { estados }) => {
  const { rows } = await db.query(
    `SELECT * FROM (${SELECT_CONVOCATORIA}) AS convocatoria
     WHERE estado = ANY($1::text[])
     ORDER BY array_position(ARRAY['ABIERTA', 'PROGRAMADA', 'CERRADA'], estado),
              CASE WHEN estado <> 'CERRADA' THEN fecha_cierre_postulacion END ASC,
              fecha_cierre_postulacion DESC,
              publicada_en DESC`,
    [estados]
  );
  return rows.map(aConvocatoria);
};

const obtenerPorId = async (db, idConvocatoria) => {
  const { rows } = await db.query(`${SELECT_CONVOCATORIA} WHERE cv.id_convocatoria = $1`, [idConvocatoria]);
  return rows[0] ? aConvocatoria(rows[0]) : null;
};

const buscarCargoActivo = async (db, idCargo) => {
  const { rows } = await db.query('SELECT id_cargo, nombre FROM cargos WHERE id_cargo = $1 AND esta_activo = TRUE', [idCargo]);
  return rows[0] ?? null;
};

const buscarSucursalActiva = async (db, idSucursal) => {
  const { rows } = await db.query('SELECT id_sucursal, nombre FROM sucursales WHERE id_sucursal = $1 AND esta_activa = TRUE', [
    idSucursal,
  ]);
  return rows[0] ?? null;
};

const existeEmpleado = async (db, idEmpleado) => {
  const { rows } = await db.query('SELECT 1 FROM empleados WHERE id_empleado = $1', [idEmpleado]);
  return rows.length > 0;
};

const empleadoEstaActivo = async (db, idEmpleado) => {
  const { rows } = await db.query(
    `SELECT ee.permite_acceso AS activo
     FROM empleados e
     JOIN estados_empleado ee ON ee.id_estado_empleado = e.id_estado_empleado
     WHERE e.id_empleado = $1`,
    [idEmpleado]
  );
  return rows[0]?.activo === true;
};

const insertar = async (db, datos) => {
  const { rows } = await db.query(
    `INSERT INTO convocatorias_ascenso
       (id_cargo, id_sucursal, id_empleado_publicador, titulo, descripcion_requisitos, meses_antiguedad_minima,
        nota_minima_desempeno, fecha_inicio_postulacion, fecha_cierre_postulacion)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id_convocatoria`,
    [
      datos.id_cargo,
      datos.id_sucursal,
      datos.id_empleado_publicador,
      datos.titulo,
      datos.descripcion_requisitos,
      datos.meses_antiguedad_minima,
      datos.nota_minima_desempeno,
      datos.fecha_inicio_postulacion,
      datos.fecha_cierre_postulacion,
    ]
  );
  return rows[0].id_convocatoria;
};

const registrarNotificacionEntregada = async (db, idConvocatoria, destinatarios) => {
  await db.query(
    `UPDATE convocatorias_ascenso
     SET estado_notificacion = '${ESTADO_NOTIFICACION.ENTREGADA}',
         destinatarios_notificados = $2,
         notificada_en = CURRENT_TIMESTAMP,
         ultimo_error_notificacion = NULL
     WHERE id_convocatoria = $1`,
    [idConvocatoria, destinatarios]
  );
};

const registrarNotificacionFallida = async (db, idConvocatoria, motivo) => {
  await db.query(
    `UPDATE convocatorias_ascenso
     SET estado_notificacion = '${ESTADO_NOTIFICACION.FALLIDA}',
         destinatarios_notificados = NULL,
         notificada_en = NULL,
         ultimo_error_notificacion = $2
     WHERE id_convocatoria = $1`,
    [idConvocatoria, String(motivo ?? 'Error desconocido').slice(0, MAX_ERROR_NOTIFICACION)]
  );
};

const cerrarVencidas = async (db) => {
  const { rows } = await db.query(
    `UPDATE convocatorias_ascenso
     SET esta_abierta = FALSE, cerrada_en = CURRENT_TIMESTAMP
     WHERE esta_abierta AND fecha_cierre_postulacion < CURRENT_DATE
     RETURNING id_convocatoria`
  );
  return rows.map((fila) => fila.id_convocatoria);
};

module.exports = {
  ESTADO_NOTIFICACION,
  listar,
  obtenerPorId,
  buscarCargoActivo,
  buscarSucursalActiva,
  existeEmpleado,
  empleadoEstaActivo,
  insertar,
  registrarNotificacionEntregada,
  registrarNotificacionFallida,
  cerrarVencidas,
};
