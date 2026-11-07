const { ErrorApp } = require("../utils/errores");

const ROL_ADMINISTRADOR = "admin";

module.exports = (req, res, next) => {
  const rol = req.get("X-Rol")?.trim().toLowerCase();
  if (!rol) throw new ErrorApp(401, "Identifíquese para continuar.");
  if (rol !== ROL_ADMINISTRADOR) {
    throw new ErrorApp(403, "Solo el Administrador de RRHH puede gestionar los casos de quejas.");
  }
  req.rol = rol;
  next();
};
