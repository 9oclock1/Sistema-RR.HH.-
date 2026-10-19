const HttpError = require('../utils/HttpError');
const { normalizarUuid } = require('../validators/comunes');

// Temporal: el portal envía el empleado en X-Empleado-Id (y el usuario en X-Usuario-Id) hasta contar con autenticación.
// Sin cuenta de usuario propia, el usuario es el mismo empleado.
const identificarEmpleado = (req, res, next) => {
  const errores = [];
  const idEmpleado = normalizarUuid(req.get('X-Empleado-Id'), 'X-Empleado-Id', {}, errores);
  const idUsuario = normalizarUuid(req.get('X-Usuario-Id'), 'X-Usuario-Id', {}, errores);

  if (errores.length > 0) throw new HttpError(400, errores[0].mensaje);
  if (!idEmpleado) throw new HttpError(401, 'Identifíquese como empleado para continuar.');

  req.idEmpleado = idEmpleado;
  req.idUsuario = idUsuario || idEmpleado;
  next();
};

module.exports = identificarEmpleado;
