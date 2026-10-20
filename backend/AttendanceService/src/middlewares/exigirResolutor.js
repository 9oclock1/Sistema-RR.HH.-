const { ErrorApp } = require("../utils/errores");

const ROLES_RESOLUTORES = ["supervisor", "gerente", "admin"];

// Temporal: el portal envía el rol en X-Rol hasta contar con autenticación.
module.exports = (req, res, next) => {
  const rol = req.get("X-Rol")?.trim().toLowerCase();
  if (!ROLES_RESOLUTORES.includes(rol)) {
    throw new ErrorApp(403, "Solo un supervisor o RRHH puede aprobar o rechazar solicitudes.");
  }
  req.rol = rol;
  next();
};
