const HttpError = require("../utils/HttpError");
const {
  normalizarUuid,
  normalizarTexto,
  lanzarSiHayErrores,
} = require("../validators/comunes");

const ROLES_RECLUTAMIENTO = ["admin", "reclutador"];

// Las cabeceras HTTP solo admiten ASCII: el portal envía el nombre con encodeURIComponent («Pérez» → «P%C3%A9rez»).
const decodificarCabecera = (valor) => {
  if (!valor) return valor;
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
};

const identificarReclutador = (req, res, next) => {
  const rol = req.get("X-Rol")?.trim().toLowerCase();
  if (!rol) throw new HttpError(401, "Identifíquese para continuar.");
  if (!ROLES_RECLUTAMIENTO.includes(rol)) {
    throw new HttpError(
      403,
      "Solo el encargado de reclutamiento puede realizar esta acción.",
    );
  }

  const errores = [];
  const id = normalizarUuid(
    req.get("X-Usuario-Id"),
    "X-Usuario-Id",
    { requerido: true },
    errores,
  );
  const nombre = normalizarTexto(
    decodificarCabecera(req.get("X-Usuario-Nombre")),
    "X-Usuario-Nombre",
    { maxLength: 120 },
    errores,
  );
  if (
    errores.some(
      (error) => error.campo === "X-Usuario-Id" && error.tipo === "faltante",
    )
  ) {
    throw new HttpError(401, "Identifíquese para continuar.", {
      campos_faltantes: ["X-Usuario-Id"],
      errores: [
        {
          campo: "X-Usuario-Id",
          mensaje: "Falta el usuario responsable del cambio.",
        },
      ],
    });
  }
  lanzarSiHayErrores(errores);

  req.usuario = { id, nombre, rol };
  next();
};

module.exports = identificarReclutador;
