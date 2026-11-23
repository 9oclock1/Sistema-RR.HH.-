const pool = require("../config/db");

const COLUMNAS = "id_usuario, id_empleado, correo, hash_contrasena, rol, esta_activo";

async function buscarPorCorreo(correo) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM USUARIOS WHERE correo = $1`, [correo]);
  return rows[0];
}

async function buscarPorEmpleado(idEmpleado) {
  const { rows } = await pool.query(`SELECT ${COLUMNAS} FROM USUARIOS WHERE id_empleado = $1`, [idEmpleado]);
  return rows[0];
}

module.exports = { buscarPorCorreo, buscarPorEmpleado };
