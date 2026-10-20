const { ErrorApp } = require("../utils/errores");

// Endpoints que no invoca un usuario sino otro microservicio (p. ej. el despachador de avisos de RecruitmentService).
// Temporal, como X-Rol: la cabecera X-Servicio identifica al emisor hasta contar con autenticación entre servicios.
function exigirServicio(serviciosPermitidos = []) {
  return (req, res, next) => {
    const servicio = req.get("X-Servicio")?.trim().toLowerCase();
    if (!servicio) throw new ErrorApp(401, "Falta la cabecera «X-Servicio» del microservicio emisor.");
    if (!serviciosPermitidos.includes(servicio)) {
      throw new ErrorApp(403, `El servicio «${servicio}» no puede usar este endpoint.`);
    }
    req.servicio = servicio;
    next();
  };
}

module.exports = { exigirServicio };
