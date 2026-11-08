const identificarEmpleado = require("./identificarEmpleado");
const { UUID_RE } = require("../utils/formatos");

const ROL_ADMINISTRADOR = "admin";

module.exports = (req, res, next) => {
  const rol = req.get("X-Rol")?.trim().toLowerCase();
  if (rol !== ROL_ADMINISTRADOR) return identificarEmpleado(req, res, next);
  const idEmpleado = req.get("X-Empleado-Id")?.trim().toLowerCase();
  req.rol = rol;
  req.idEmpleado = idEmpleado && UUID_RE.test(idEmpleado) ? idEmpleado : null;
  next();
};
