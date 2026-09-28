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

module.exports = {
  UUID_RE,
  esUuidValido,
  validarCamposObligatorios,
};
