const { ErrorApp } = require("../utils/errores");
const { esUuidValido } = require("../utils/validaciones");

// Jerarquía de roles del sistema de RR.HH.
const ROLES_JERARQUIA = {
  admin: ["admin", "gerente", "supervisor", "reclutador", "empleado"],
  gerente: ["gerente", "supervisor", "empleado"],
  supervisor: ["supervisor", "empleado"],
  reclutador: ["reclutador", "empleado"],
  empleado: ["empleado"],
};

function tienePermiso(rolUsuario, rolesRequeridos = []) {
  if (!rolUsuario || rolesRequeridos.length === 0) return true;
  const rolNormalizado = rolUsuario.toLowerCase().trim();
  const incluidos = ROLES_JERARQUIA[rolNormalizado] || [rolNormalizado];
  return rolesRequeridos.some((reqRol) => incluidos.includes(reqRol.toLowerCase().trim()));
}

// Extrae la identidad del usuario y empleado desde las cabeceras HTTP de la petición
function extraerIdentidad(req, res, next) {
  const empIdRaw = req.get("X-Empleado-Id")?.trim().toLowerCase();
  const usrIdRaw = req.get("X-Usuario-Id")?.trim().toLowerCase();

  if (empIdRaw && !esUuidValido(empIdRaw)) {
    throw new ErrorApp(400, "El encabezado «X-Empleado-Id» debe tener un formato UUID válido.");
  }
  if (usrIdRaw && !esUuidValido(usrIdRaw)) {
    throw new ErrorApp(400, "El encabezado «X-Usuario-Id» debe tener un formato UUID válido.");
  }

  req.idEmpleado = empIdRaw || null;
  req.idUsuario = usrIdRaw || req.idEmpleado || null;
  req.rol = req.get("X-Rol")?.trim().toLowerCase() || "empleado";
  next();
}

// Exige que la petición provenga de un empleado identificado con UUID válido
function exigirEmpleado(req, res, next) {
  const idEmpleado = req.get("X-Empleado-Id")?.trim().toLowerCase();
  if (!idEmpleado) {
    throw new ErrorApp(401, "Identifíquese como empleado para continuar.");
  }
  if (!esUuidValido(idEmpleado)) {
    throw new ErrorApp(400, "El encabezado «X-Empleado-Id» debe tener un formato UUID válido.");
  }

  const idUsuario = req.get("X-Usuario-Id")?.trim().toLowerCase() || idEmpleado;
  if (idUsuario && !esUuidValido(idUsuario)) {
    throw new ErrorApp(400, "El encabezado «X-Usuario-Id» debe tener un formato UUID válido.");
  }

  req.idEmpleado = idEmpleado;
  req.idUsuario = idUsuario;
  req.rol = req.get("X-Rol")?.trim().toLowerCase() || "empleado";
  next();
}

// Control de acceso basado en roles para endpoints específicos
function exigirRol(rolesPermitidos = []) {
  return (req, res, next) => {
    const rol = req.rol || req.get("X-Rol")?.trim().toLowerCase() || "empleado";
    if (!tienePermiso(rol, rolesPermitidos)) {
      throw new ErrorApp(
        403,
        `Acceso restringido: esta acción requiere rol [${rolesPermitidos.join(", ")}]. Rol actual: «${rol}».`
      );
    }
    next();
  };
}

// Validador de parámetros de ruta UUID (p. ej. :idDestinatario, :idComunicacion)
function validarParamUuid(nombreParam) {
  return (req, res, next) => {
    const valor = req.params[nombreParam];
    if (valor && !esUuidValido(valor)) {
      throw new ErrorApp(400, `El parámetro de ruta «${nombreParam}» debe ser un identificador UUID válido.`);
    }
    next();
  };
}

// Exige que la petición provenga de un usuario o supervisor identificado
function exigirIdentidad(req, res, next) {
  const empIdRaw = req.get("X-Empleado-Id")?.trim().toLowerCase();
  const usrIdRaw = req.get("X-Usuario-Id")?.trim().toLowerCase();

  if (!empIdRaw && !usrIdRaw) {
    throw new ErrorApp(401, "Identifíquese para continuar.");
  }
  if (empIdRaw && !esUuidValido(empIdRaw)) {
    throw new ErrorApp(400, "El encabezado «X-Empleado-Id» debe tener un formato UUID válido.");
  }
  if (usrIdRaw && !esUuidValido(usrIdRaw)) {
    throw new ErrorApp(400, "El encabezado «X-Usuario-Id» debe tener un formato UUID válido.");
  }

  req.idEmpleado = empIdRaw || usrIdRaw;
  req.idUsuario = usrIdRaw || empIdRaw;
  req.rol = req.get("X-Rol")?.trim().toLowerCase() || "empleado";
  next();
}

module.exports = {
  extraerIdentidad,
  exigirEmpleado,
  exigirIdentidad,
  exigirRol,
  validarParamUuid,
};
