const pool = require('../config/db');

const obtenerTodos = async (areaId) => {
    let query = 'SELECT * FROM cargos WHERE activo = true';
    const values = [];

    if (areaId) {
        query += ' AND id_departamento = $1';
        values.push(areaId);
    }
    
    query += ' ORDER BY id_cargo ASC';
    const result = await pool.query(query, values);
    return result.rows;
};

const crear = async (datos) => {
    const query = `
        INSERT INTO cargos (nombre, id_nivel_salarial, id_departamento, perfil_requerido)
        VALUES ($1, $2, $3, $4)
        RETURNING *;
    `;
    const values = [
        datos.nombre,
        datos.id_nivel_salarial,
        datos.id_departamento || null,
        datos.perfil_requerido || null
    ];

    const result = await pool.query(query, values);
    return result.rows[0];
};

module.exports = { obtenerTodos, crear };