const { ErrorApp } = require("../utils/errores");

module.exports = (roles, mensaje) => (req, res, next) => {
  const rol = req.get("X-Rol")?.trim().toLowerCase();
  if (!rol) throw new ErrorApp(401, "Identifíquese para continuar.");
  if (!roles.includes(rol)) throw new ErrorApp(403, mensaje);
  req.rol = rol;
  next();
};
