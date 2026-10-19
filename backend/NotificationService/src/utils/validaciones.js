const { ErrorApp } = require("./errores");

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function esUuidValido(valor) {
  return typeof valor === "string" && UUID_RE.test(valor.trim());
}

function validarCamposObligatorios(asunto, contenido) {
  const detalles = [];
  const asuntoLimpio = typeof asunto === "string" ? asunto.trim() : "";
  const contenidoLimpio = typeof contenido === "string" ? contenido.trim() : "";

  if (!asuntoLimpio) {
    detalles.push({ campo: "asunto", mensaje: "El asunto es obligatorio y no puede estar vacío." });
  } else if (asuntoLimpio.length > 150) {
    detalles.push({ campo: "asunto", mensaje: "El asunto no puede exceder los 150 caracteres." });
  }

  if (!contenidoLimpio) {
    detalles.push({ campo: "contenido", mensaje: "El contenido del mensaje es obligatorio y no puede estar vacío." });
  }

  if (detalles.length > 0) {
    throw new ErrorApp(400, "Debe completar todos los campos obligatorios.", detalles);
  }

  return { asunto: asuntoLimpio, contenido: contenidoLimpio };
}

const PRIORIDADES = ["NORMAL", "ALTA"];

// RF-39: prioridad opcional del mensaje; sin ella es NORMAL.
function validarPrioridad(valor) {
  if (valor === undefined || valor === null || valor === "") return "NORMAL";
  const prioridad = typeof valor === "string" ? valor.trim().toUpperCase() : null;
  if (!PRIORIDADES.includes(prioridad)) {
    throw new ErrorApp(400, `La prioridad debe ser uno de: ${PRIORIDADES.join(", ")}.`, [
      { campo: "prioridad", mensaje: "Prioridad inválida." },
    ]);
  }
  return prioridad;
}

// RF-39: enlace opcional a una ruta interna del portal. Se rechazan URLs externas o con esquema (javascript:, http:).
function validarEnlace(valor) {
  if (valor === undefined || valor === null || valor === "") return null;
  const enlace = typeof valor === "string" ? valor.trim() : "";
  if (!/^\/(?!\/)[\w\-/?=&.%]*$/.test(enlace) || enlace.length > 255) {
    throw new ErrorApp(400, "El enlace debe ser una ruta interna del portal que empiece con «/».", [
      { campo: "enlace", mensaje: "Enlace inválido." },
    ]);
  }
  return enlace;
}

function validarUuid(valor, nombreCampo = "id") {
  if (!valor || typeof valor !== "string" || !UUID_RE.test(valor.trim())) {
    throw new ErrorApp(400, `El identificador «${nombreCampo}» debe ser un UUID válido.`);
  }
  return valor.trim().toLowerCase();
}

module.exports = {
  UUID_RE,
  esUuidValido,
  validarUuid,
  validarCamposObligatorios,
  validarPrioridad,
  validarEnlace,
};

