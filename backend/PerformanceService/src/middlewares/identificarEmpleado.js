const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");

module.exports = (req, res, next) => {
  const idEmpleado = req.get("X-Empleado-Id")?.trim().toLowerCase();
  if (!idEmpleado)
    throw new ErrorApp(401, "Identifíquese como empleado para continuar.");
  if (!UUID_RE.test(idEmpleado))
    throw new ErrorApp(
      403,
      "El usuario no corresponde a un empleado registrado.",
    );
  req.idEmpleado = idEmpleado;
  next();
};
