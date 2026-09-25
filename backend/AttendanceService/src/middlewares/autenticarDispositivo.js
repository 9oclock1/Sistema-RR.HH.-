const { ErrorApp } = require("../utils/errores");
const { leerDispositivos } = require("../utils/dispositivos");

const dispositivos = leerDispositivos(process.env.DISPOSITIVOS_BIOMETRICOS);

module.exports = (req, res, next) => {
  const codigo = dispositivos.get(req.get("X-Dispositivo-Clave") ?? "");
  if (!codigo) throw new ErrorApp(401, "Dispositivo biométrico no autorizado.");
  req.codigoDispositivo = codigo;
  next();
};
