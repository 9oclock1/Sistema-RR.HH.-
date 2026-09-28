const { ErrorApp } = require("../utils/errores");

// Extrae la identidad del usuario y empleado desde las cabeceras HTTP de la petición
function extraerIdentidad(req, res, next) {
  req.idEmpleado = req.get("X-Empleado-Id")?.trim().toLowerCase() || null;
  req.idUsuario = req.get("X-Usuario-Id")?.trim().toLowerCase() || req.idEmpleado;
  req.rol = req.get("X-Rol")?.trim().toLowerCase() || "empleado";
  next();
}

// Exige que la petición provenga de un empleado identificado (para bandeja y confirmaciones)
function exigirEmpleado(req, res, next) {
  const idEmpleado = req.get("X-Empleado-Id")?.trim().toLowerCase();
  if (!idEmpleado) {
    throw new ErrorApp(401, "Identifíquese como empleado para acceder a su bandeja de mensajes.");
  }
  req.idEmpleado = idEmpleado;
  req.idUsuario = req.get("X-Usuario-Id")?.trim().toLowerCase() || idEmpleado;
  req.rol = req.get("X-Rol")?.trim().toLowerCase() || "empleado";
  next();
}

module.exports = {
  extraerIdentidad,
  exigirEmpleado,
};
