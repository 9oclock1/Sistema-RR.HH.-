const pool = require("../config/db");

async function listarCategorias(db = pool) {
  const { rows } = await db.query(
    `SELECT id_categoria_queja, codigo, nombre
     FROM catalogos_categoria_queja
     ORDER BY id_categoria_queja`,
  );
  return rows;
}

async function obtenerEstado(idEstado, db = pool) {
  const { rows } = await db.query(
    `SELECT codigo, nombre, es_final FROM catalogos_estado_queja WHERE id_estado_queja = $1`,
    [idEstado],
  );
  return rows[0] ?? null;
}

async function sincronizarEmpleado(db, { idEmpleado, nombres, apellidos }) {
  await db.query(
    `INSERT INTO empleados (id_empleado, nombres, apellidos)
     VALUES ($1, $2, $3)
     ON CONFLICT (id_empleado) DO UPDATE
       SET nombres = COALESCE(EXCLUDED.nombres, empleados.nombres),
           apellidos = COALESCE(EXCLUDED.apellidos, empleados.apellidos),
           actualizado_en = CASE WHEN EXCLUDED.nombres IS NULL THEN empleados.actualizado_en ELSE CURRENT_TIMESTAMP END`,
    [idEmpleado, nombres, apellidos],
  );
}

async function insertarQueja(db, { idEmpleado, idCategoria, esAnonima, codigo, asunto, descripcion, idEstado }) {
  const { rows } = await db.query(
    `INSERT INTO quejas (id_empleado_denunciante, id_categoria_queja, id_estado_queja, es_anonima,
                         codigo_seguimiento, asunto, descripcion)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id_queja, creado_en`,
    [idEmpleado, idCategoria, idEstado, esAnonima, codigo, asunto, descripcion],
  );
  return rows[0];
}

async function insertarHistorialInicial(db, { idQueja, idEstado }) {
  await db.query(`INSERT INTO historiales_estado_queja (id_queja, id_estado_queja) VALUES ($1, $2)`, [
    idQueja,
    idEstado,
  ]);
}

async function insertarAdjunto(db, { idQueja, orden, nombreOriginal, tipo, tamano, clave }) {
  await db.query(
    `INSERT INTO adjuntos_queja (id_queja, orden, nombre_original, tipo_mime, tamano_bytes, clave_almacenamiento)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [idQueja, orden, nombreOriginal, tipo, tamano, clave],
  );
}

async function obtenerSeguimiento(codigo, db = pool) {
  const { rows } = await db.query(
    `SELECT q.id_queja, q.codigo_seguimiento, q.creado_en, q.actualizado_en,
            eq.codigo AS estado_codigo, eq.nombre AS estado_nombre, eq.es_final,
            cq.nombre AS categoria
     FROM quejas q
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = q.id_estado_queja
     JOIN catalogos_categoria_queja cq ON cq.id_categoria_queja = q.id_categoria_queja
     WHERE q.codigo_seguimiento = $1`,
    [codigo],
  );
  return rows[0] ?? null;
}

async function listarHistorialPublico(idQueja, db = pool) {
  const { rows } = await db.query(
    `SELECT eq.codigo, eq.nombre, h.fecha_cambio
     FROM historiales_estado_queja h
     JOIN catalogos_estado_queja eq ON eq.id_estado_queja = h.id_estado_queja
     WHERE h.id_queja = $1
     ORDER BY h.fecha_cambio`,
    [idQueja],
  );
  return rows;
}

module.exports = {
  listarCategorias,
  obtenerEstado,
  obtenerSeguimiento,
  listarHistorialPublico,
  sincronizarEmpleado,
  insertarQueja,
  insertarHistorialInicial,
  insertarAdjunto,
};
