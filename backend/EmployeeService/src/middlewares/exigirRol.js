const HttpError = require('../utils/HttpError');

// Temporal: el rol llega en X-Rol, sin verificar, hasta que AuthService emita credenciales firmadas.
const exigirRol = (...rolesPermitidos) => (req, res, next) => {
  const rol = req.get('X-Rol')?.trim().toLowerCase();
  if (!rol) throw new HttpError(401, 'Identifíquese para continuar.');
  if (!rolesPermitidos.includes(rol)) {
    throw new HttpError(403, 'Su rol no tiene permiso para consultar este recurso.');
  }
  req.rol = rol;
  next();
};

module.exports = exigirRol;
