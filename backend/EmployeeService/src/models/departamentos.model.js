// src/models/departamentos.model.js
const pool = require('../../db/pool'); // EmployeeService/db/pool.js

/**
 * Criterio 1: registrar un área con nombre y descripción
 */
async function crear({ codigo, nombre, tipo, descripcion, id_departamento_padre, id_sucursal }) {
  const query = `
    INSERT INTO departamentos (codigo, nombre, tipo, descripcion, id_departamento_padre, id_sucursal)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [codigo, nombre, tipo || 'departamento', descripcion, id_departamento_padre || null, id_sucursal || null];
  const { rows } = await pool.query(query, values);
  return rows[0];
}

/**
 * Criterio 1: listado de áreas activas
 */
async function listarActivas() {
  const { rows } = await pool.query(
    `SELECT * FROM vista_departamentos_activos;`
  );
  return rows;
}

async function obtenerPorId(id_departamento) {
  const { rows } = await pool.query(
    `SELECT * FROM departamentos WHERE id_departamento = $1;`,
    [id_departamento]
  );
  return rows[0] || null;
}

/**
 * Criterio 2: modificar nombre o descripción, conservando el id
 */
async function actualizar(id_departamento, { nombre, descripcion }) {
  const query = `
    UPDATE departamentos
    SET nombre = COALESCE($2, nombre),
        descripcion = COALESCE($3, descripcion)
    WHERE id_departamento = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [id_departamento, nombre, descripcion]);
  return rows[0] || null;
}

/**
 * Criterios 3 y 4: dar de baja.
 * La validación real (cargos/empleados activos) vive en el trigger
 * trg_validar_baja_departamento; aquí solo propagamos el resultado
 * o el error que lanza la base de datos.
 */
async function darDeBaja(id_departamento) {
  const query = `
    UPDATE departamentos
    SET activo = FALSE
    WHERE id_departamento = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(query, [id_departamento]);
  return rows[0] || null;
}

async function reactivar(id_departamento) {
  const { rows } = await pool.query(
    `UPDATE departamentos SET activo = TRUE WHERE id_departamento = $1 RETURNING *;`,
    [id_departamento]
  );
  return rows[0] || null;
}

module.exports = {
  crear,
  listarActivas,
  obtenerPorId,
  actualizar,
  darDeBaja,
  reactivar,
};