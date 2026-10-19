const pool = require('../../db/pool');
const empleadosModel = require('../models/empleadosModel');
const { noEncontrado } = require('./empleadosService');

const obtenerSupervisor = async (idEmpleado) => {
  const fila = await empleadosModel.obtenerSupervisor(pool, idEmpleado);
  if (!fila) throw noEncontrado();
  return { id_empleado: fila.id_empleado, supervisor: fila.supervisor };
};

module.exports = { obtenerSupervisor };
