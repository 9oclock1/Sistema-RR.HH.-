const { ErrorApp } = require("../utils/errores");

// Temporal: el portal envía el empleado en X-Empleado-Id hasta contar con autenticación.
module.exports = (req, res, next) => {
  const idEmpleado = req.get("X-Empleado-Id")?.trim().toLowerCase();
  if (!idEmpleado) throw new ErrorApp(401, "Identifíquese como empleado para continuar.");
  req.idEmpleado = idEmpleado;
  next();
};
