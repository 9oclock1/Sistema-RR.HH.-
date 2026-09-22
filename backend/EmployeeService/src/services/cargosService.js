const cargosModel = require('../models/cargosModel');

const listarCargos = async (areaId) => {
    if (areaId && isNaN(areaId)) {
        throw new Error('El ID del departamento debe ser un número válido');
    }
    return await cargosModel.obtenerTodos(areaId);
};

const registrarCargo = async (datosCargo) => {
    return await cargosModel.crear(datosCargo);
};

module.exports = { listarCargos, registrarCargo };