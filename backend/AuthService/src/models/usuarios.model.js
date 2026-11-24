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

async function obtenerUltimaRevocacion(idEmpleado) {
  const { rows } = await pool.query(
    `SELECT id_revocacion, id_empleado, id_usuario, motivo, id_proceso, solicitado_por, revocado_en
       FROM REVOCACIONES_ACCESO
      WHERE id_empleado = $1
      ORDER BY revocado_en DESC, id_revocacion DESC
      LIMIT 1`,
    [idEmpleado]
  );
  return rows[0] || null;
}

async function revocarAcceso({ idEmpleado, idProceso = null, solicitadoPor = null }) {
  const cliente = await pool.connect();
  try {
    await cliente.query("BEGIN");

    const { rows: usuarios } = await cliente.query(
      `SELECT id_usuario, esta_activo
         FROM USUARIOS
        WHERE id_empleado = $1
        FOR UPDATE`,
      [idEmpleado]
    );
    const usuario = usuarios[0] || null;

    if (idProceso) {
      const { rows: existentes } = await cliente.query(
        `SELECT id_revocacion, id_usuario, revocado_en
           FROM REVOCACIONES_ACCESO
          WHERE id_empleado = $1
            AND id_proceso = $2
          ORDER BY revocado_en DESC
          LIMIT 1`,
        [idEmpleado, idProceso]
      );
      if (existentes[0]) {
        if (usuario?.esta_activo) {
          await cliente.query(
            `UPDATE USUARIOS
                SET esta_activo = FALSE,
                    actualizado_en = CURRENT_TIMESTAMP
              WHERE id_usuario = $1`,
            [usuario.id_usuario]
          );
        }
        await cliente.query("COMMIT");
        if (!usuario && !existentes[0].id_usuario) {
          return { cuenta_estado: "SIN_CUENTA" };
        }
        return { cuenta_estado: "REVOCADA", revocado_en: existentes[0].revocado_en };
      }
    }

    if (usuario) {
      await cliente.query(
        `UPDATE USUARIOS
            SET esta_activo = FALSE,
                actualizado_en = CURRENT_TIMESTAMP
          WHERE id_usuario = $1`,
        [usuario.id_usuario]
      );
    }

    const { rows: insertadas } = await cliente.query(
      `INSERT INTO REVOCACIONES_ACCESO (id_empleado, id_usuario, motivo, id_proceso, solicitado_por)
       VALUES ($1, $2, 'DESVINCULACION', $3, $4)
       RETURNING revocado_en`,
      [idEmpleado, usuario?.id_usuario ?? null, idProceso, solicitadoPor]
    );

    await cliente.query("COMMIT");
    if (!usuario) {
      return { cuenta_estado: "SIN_CUENTA" };
    }
    return { cuenta_estado: "REVOCADA", revocado_en: insertadas[0].revocado_en };
  } catch (error) {
    await cliente.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    cliente.release();
  }
}

module.exports = { buscarPorCorreo, buscarPorEmpleado, obtenerUltimaRevocacion, revocarAcceso };
