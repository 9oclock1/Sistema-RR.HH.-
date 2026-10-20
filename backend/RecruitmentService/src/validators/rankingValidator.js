const HttpError = require("../utils/HttpError");

const CRITERIOS_DESEMPATE = ["experiencia", "fecha_postulacion", "educacion"];
const ORDENES = ["asc", "desc"];

function validarConsultaRanking(req, res, next) {
  const {
    desempate = "experiencia",
    experiencia_min,
    etapa,
    ciudad,
    pagina = "1",
    limite = "10",
  } = req.query;

  const errores = [];

  const criterioNormalizado = String(desempate).toLowerCase().trim();
  if (!CRITERIOS_DESEMPATE.includes(criterioNormalizado)) {
    errores.push({
      campo: "desempate",
      mensaje: `El criterio de desempate debe ser uno de: ${CRITERIOS_DESEMPATE.join(", ")}.`,
    });
  }

  // Por defecto, la fecha de postulación desempata a favor de quien postuló primero; el resto, de mayor a menor.
  const { orden_desempate = criterioNormalizado === "fecha_postulacion" ? "asc" : "desc" } = req.query;
  const ordenNormalizado = String(orden_desempate).toLowerCase().trim();
  if (!ORDENES.includes(ordenNormalizado)) {
    errores.push({
      campo: "orden_desempate",
      mensaje: "El orden de desempate debe ser 'asc' o 'desc'.",
    });
  }

  if (experiencia_min !== undefined && experiencia_min !== "") {
    const exp = Number(experiencia_min);
    if (isNaN(exp) || exp < 0) {
      errores.push({
        campo: "experiencia_min",
        mensaje:
          "El filtro 'experiencia_min' debe ser un número mayor o igual a 0.",
      });
    }
  }

  const numPagina = Number(pagina);
  const numLimite = Number(limite);
  if (!Number.isInteger(numPagina) || numPagina < 1) {
    errores.push({
      campo: "pagina",
      mensaje: "La página debe ser un entero >= 1.",
    });
  }
  if (!Number.isInteger(numLimite) || numLimite < 1 || numLimite > 100) {
    errores.push({
      campo: "limite",
      mensaje: "El límite debe ser un entero entre 1 y 100.",
    });
  }

  if (errores.length > 0) {
    return next(
      new HttpError(400, "Parámetros de búsqueda o ranking inválidos.", {
        errores,
      }),
    );
  }

  req.querySanitizada = {
    desempate: criterioNormalizado,
    orden_desempate: ordenNormalizado,
    experiencia_min:
      experiencia_min !== undefined && experiencia_min !== ""
        ? Number(experiencia_min)
        : null,
    etapa: etapa ? String(etapa).trim() : null,
    ciudad: ciudad ? String(ciudad).trim() : null,
    pagina: numPagina,
    limite: numLimite,
  };

  next();
}

module.exports = {
  validarConsultaRanking,
  CRITERIOS_DESEMPATE,
};
