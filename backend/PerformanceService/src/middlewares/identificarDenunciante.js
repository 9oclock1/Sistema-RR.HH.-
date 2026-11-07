const identificarEmpleado = require("./identificarEmpleado");
const { leerAnonima } = require("../utils/quejas");

module.exports = (req, res, next) => {
  if (leerAnonima(req.body?.anonima) !== false) return next();
  identificarEmpleado(req, res, next);
};
