const HttpError = require("../utils/HttpError");

const CRITERIOS_DESEMPATE = ["experiencia", "fecha_postulacion", "educacion"];
const ORDENES = ["asc", "desc"];

function validarConsultaRanking(req, res, next) {
  const {
    desempate = "experiencia",
    orden_desempate = "desc",
    experiencia_min,
    pretension_salarial_max,
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

  if (pretension_salarial_max !== undefined && pretension_salarial_max !== "") {
    const sal = Number(pretension_salarial_max);
    if (isNaN(sal) || sal <= 0) {
      errores.push({
        campo: "pretension_salarial_max",
        mensaje:
          "El filtro 'pretension_salarial_max' debe ser un número positivo.",
      });
    }
  }

  const numPagina = Number(pagina);
  const numLimite = Number(limite);
  if (isNaN(numPagina) || numPagina < 1) {
    errores.push({
      campo: "pagina",
      mensaje: "La página debe ser un entero >= 1.",
    });
  }
  if (isNaN(numLimite) || numLimite < 1 || numLimite > 100) {
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
    pretension_salarial_max:
      pretension_salarial_max !== undefined && pretension_salarial_max !== ""
        ? Number(pretension_salarial_max)
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
