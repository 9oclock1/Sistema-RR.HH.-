const pool = require("../config/db");

const SELECT_PROCESO = `
  SELECT p.id_proceso,
         p.id_empleado,
         p.nombre_empleado,
         p.fecha_ingreso,
         p.codigo_causal,
         c.nombre AS causal_nombre,
         p.fecha_retiro,
         p.corresponde_desahucio,
         p.estado,
         p.observaciones,
         p.registrado_por,
         p.creado_en,
         d.nombre_archivo,
         d.tipo_mime,
         d.tamano_bytes,
         pi.promedio AS pi_promedio,
         pi.meses_considerados AS pi_meses_considerados,
         pi.calculado_en AS pi_calculado_en,
         b.total AS b_total,
         b.promedio_base AS b_promedio_base,
         b.calculado_en AS b_calculado_en
    FROM PROCESOS_DESVINCULACION p
    JOIN CAUSALES_DESVINCULACION c ON c.codigo = p.codigo_causal
    JOIN DOCUMENTOS_DESVINCULACION d ON d.id_proceso = p.id_proceso
    LEFT JOIN PROMEDIOS_INDEMNIZABLES pi ON pi.id_proceso = p.id_proceso
    LEFT JOIN BENEFICIOS_SOCIALES b ON b.id_proceso = p.id_proceso
`;

function aProceso(fila) {
  if (!fila) return null;
  return {
    id_proceso: fila.id_proceso,
    id_empleado: fila.id_empleado,
    nombre_empleado: fila.nombre_empleado,
    fecha_ingreso: fila.fecha_ingreso,
    causal: { codigo: fila.codigo_causal, nombre: fila.causal_nombre },
    fecha_retiro: fila.fecha_retiro,
    corresponde_desahucio: fila.corresponde_desahucio,
    estado: fila.estado,
    observaciones: fila.observaciones,
    documento: {
      nombre_archivo: fila.nombre_archivo,
      tipo_mime: fila.tipo_mime,
      tamano_bytes: fila.tamano_bytes,
    },
    promedio_indemnizable:
      fila.pi_promedio !== null && fila.pi_promedio !== undefined
        ? {
            promedio: fila.pi_promedio,
            meses_considerados: fila.pi_meses_considerados,
            calculado_en: fila.pi_calculado_en,
          }
        : null,
    beneficios_sociales:
      fila.b_total !== null && fila.b_total !== undefined
        ? {
            total: fila.b_total,
            calculado_en: fila.b_calculado_en,
            desactualizado: fila.pi_promedio !== fila.b_promedio_base,
          }
        : null,
    registrado_por: fila.registrado_por,
    creado_en: fila.creado_en,
  };
}

async function listarCausalesActivas() {
  const { rows } = await pool.query(
    `SELECT codigo, nombre, descripcion, corresponde_desahucio
       FROM CAUSALES_DESVINCULACION
      WHERE esta_activo = TRUE
      ORDER BY orden ASC`
  );
  return rows;
}

async function obtenerCausalActiva(codigo) {
  const { rows } = await pool.query(
    `SELECT codigo, nombre, descripcion, corresponde_desahucio, esta_activo
       FROM CAUSALES_DESVINCULACION
      WHERE codigo = $1 AND esta_activo = TRUE`,
    [codigo]
  );
  return rows[0] || null;
}

async function listarProcesos({ estado, codigo_causal, id_empleado } = {}) {
  const condiciones = [];
  const params = [];
  if (estado) {
    params.push(estado);
    condiciones.push(`p.estado = $${params.length}`);
  }
  if (codigo_causal) {
    params.push(codigo_causal);
    condiciones.push(`p.codigo_causal = $${params.length}`);
  }
  if (id_empleado) {
    params.push(id_empleado);
    condiciones.push(`p.id_empleado = $${params.length}`);
  }
  const filtro = condiciones.length ? `WHERE ${condiciones.join(" AND ")}` : "";
  const { rows } = await pool.query(`${SELECT_PROCESO} ${filtro} ORDER BY p.creado_en DESC`, params);
  return rows.map(aProceso);
}

async function obtenerProceso(idProceso, db = pool) {
  const { rows } = await db.query(`${SELECT_PROCESO} WHERE p.id_proceso = $1`, [idProceso]);
  return aProceso(rows[0]);
}

async function obtenerProcesoAbiertoPorEmpleado(idEmpleado) {
  const { rows } = await pool.query(
    `SELECT id_proceso, estado
       FROM PROCESOS_DESVINCULACION
      WHERE id_empleado = $1 AND estado IN ('INICIADO', 'EN_CURSO')
      LIMIT 1`,
    [idEmpleado]
  );
  return rows[0] || null;
}

async function crearProceso(cliente, proceso) {
  const { rows } = await cliente.query(
    `INSERT INTO PROCESOS_DESVINCULACION (
       id_empleado, nombre_empleado, fecha_ingreso, codigo_causal, fecha_retiro,
       corresponde_desahucio, observaciones, estado, registrado_por, registrado_por_rol
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'INICIADO', $8, $9)
     RETURNING id_proceso`,
    [
      proceso.id_empleado,
      proceso.nombre_empleado,
      proceso.fecha_ingreso,
      proceso.codigo_causal,
      proceso.fecha_retiro,
      proceso.corresponde_desahucio,
      proceso.observaciones,
      proceso.registrado_por,
      proceso.registrado_por_rol,
    ]
  );
  return rows[0].id_proceso;
}

async function crearDocumento(cliente, doc) {
  await cliente.query(
    `INSERT INTO DOCUMENTOS_DESVINCULACION (id_proceso, nombre_archivo, tipo_mime, tamano_bytes, contenido)
     VALUES ($1, $2, $3, $4, $5)`,
    [doc.id_proceso, doc.nombre_archivo, doc.tipo_mime, doc.tamano_bytes, doc.contenido]
  );
}

async function obtenerDocumento(idProceso) {
  const { rows } = await pool.query(
    `SELECT id_proceso, nombre_archivo, tipo_mime, tamano_bytes, contenido
       FROM DOCUMENTOS_DESVINCULACION
      WHERE id_proceso = $1`,
    [idProceso]
  );
  return rows[0] || null;
}

module.exports = {
  listarCausalesActivas,
  obtenerCausalActiva,
  listarProcesos,
  obtenerProceso,
  obtenerProcesoAbiertoPorEmpleado,
  crearProceso,
  crearDocumento,
  obtenerDocumento,
};
