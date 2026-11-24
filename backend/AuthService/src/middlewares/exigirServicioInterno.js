const { timingSafeEqual } = require("node:crypto");
const { ErrorApp } = require("../utils/errores");

// Protege los endpoints internos usados por CompensationService (el gateway expone /api/auth/ al navegador).
module.exports = function exigirServicioInterno(req, res, next) {
  const esperada = process.env.CLAVE_SERVICIOS_INTERNOS;
  if (!esperada) {
    throw new ErrorApp(503, "Servicio interno deshabilitado: falta CLAVE_SERVICIOS_INTERNOS.");
  }

  const recibida = req.get("X-Clave-Servicio") ?? "";
  const bufEsperada = Buffer.from(esperada, "utf8");
  const bufRecibida = Buffer.from(recibida, "utf8");

  if (bufRecibida.length !== bufEsperada.length || !timingSafeEqual(bufRecibida, bufEsperada)) {
    throw new ErrorApp(403, "No tiene autorización para ejecutar esta operación interna.");
  }

  next();
};
