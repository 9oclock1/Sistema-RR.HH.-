const HttpError = require('../utils/HttpError');
const { normalizarUuid } = require('../validators/comunes');
const identificarEmpleado = require('./identificarEmpleado');

const ROLES_RRHH = ['admin', 'gerente'];

const leerEmpleadoOpcional = (req, res, next) => {
  const errores = [];
  const idEmpleado = normalizarUuid(req.get('X-Empleado-Id'), 'X-Empleado-Id', {}, errores);
  if (errores.length > 0) throw new HttpError(400, errores[0].mensaje);
  req.idEmpleado = idEmpleado;
  next();
};

const identificarLector = (req, res, next) => {
  const rol = req.get('X-Rol')?.trim().toLowerCase();
  if (ROLES_RRHH.includes(rol)) {
    req.esRrhh = true;
    return leerEmpleadoOpcional(req, res, next);
  }
  return identificarEmpleado(req, res, next);
};

module.exports = { leerEmpleadoOpcional, identificarLector };
