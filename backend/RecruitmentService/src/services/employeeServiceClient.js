const HttpError = require('../utils/HttpError');
const { employeeServiceUrl, employeeServiceTimeoutMs } = require('../config');

const obtenerCargo = async (idCargo) => {
  let respuesta;
  try {
    respuesta = await fetch(`${employeeServiceUrl}/cargos/${encodeURIComponent(idCargo)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(employeeServiceTimeoutMs),
    });
  } catch (error) {
    console.error(`No se pudo contactar a EmployeeService para leer el cargo ${idCargo}`, error);
    throw new HttpError(503, 'No se pudo consultar el catálogo de cargos: EmployeeService no responde. Inténtelo más tarde.');
  }

  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    console.error(`EmployeeService respondió ${respuesta.status} al leer el cargo ${idCargo}`);
    throw new HttpError(502, 'El catálogo de cargos respondió con un error inesperado.');
  }
  return respuesta.json();
};

// Evaluador de una entrevista: { id_empleado, nombres, apellidos, activo } o null si no existe.
const obtenerEmpleado = async (idEmpleado) => {
  let respuesta;
  try {
    respuesta = await fetch(`${employeeServiceUrl}/empleados/${encodeURIComponent(idEmpleado)}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(employeeServiceTimeoutMs),
    });
  } catch (error) {
    console.error(`No se pudo contactar a EmployeeService para leer el empleado ${idEmpleado}`, error);
    throw new HttpError(503, 'No se pudo verificar al evaluador: EmployeeService no responde. Inténtelo más tarde.');
  }

  if (respuesta.status === 404) return null;
  if (!respuesta.ok) {
    console.error(`EmployeeService respondió ${respuesta.status} al leer el empleado ${idEmpleado}`);
    throw new HttpError(502, 'El registro de empleados respondió con un error inesperado.');
  }
  return respuesta.json();
};

module.exports = { obtenerCargo, obtenerEmpleado };
