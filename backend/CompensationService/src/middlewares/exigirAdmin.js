const { validarAdmin } = require("../utils/desvinculaciones");

// Valida el rol de Administrador antes de leer archivos adjuntos con multer.
module.exports = (req, _res, next) => {
  try {
    validarAdmin({ rol: req.get("X-Rol") });
    next();
  } catch (error) {
    next(error);
  }
};
