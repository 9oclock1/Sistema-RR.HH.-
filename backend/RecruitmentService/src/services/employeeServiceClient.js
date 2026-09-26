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

module.exports = { obtenerCargo };
