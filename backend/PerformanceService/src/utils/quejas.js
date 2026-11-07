const { ErrorApp } = require("./errores");

const ESTADO_QUEJA = { REGISTRADA: 1 };
const ASUNTO = { MIN: 5, MAX: 150 };
const DESCRIPCION = { MIN: 20, MAX: 5000 };
const ADJUNTOS = {
  MAX_MB: 5,
  MAX_ARCHIVOS: 3,
  TIPOS: { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" },
};
ADJUNTOS.MAX_BYTES = ADJUNTOS.MAX_MB * 1024 * 1024;

function leerAnonima(valor) {
  if (valor === true || valor === "true") return true;
  if (valor === false || valor === "false") return false;
  return null;
}

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

function validarLargo(errores, campo, valor, { MIN, MAX }, { vacio, nombre }) {
  if (!valor) errores.push({ campo, mensaje: vacio });
  else if (valor.length < MIN) errores.push({ campo, mensaje: `${nombre} debe tener al menos ${MIN} caracteres.` });
  else if (valor.length > MAX) errores.push({ campo, mensaje: `${nombre} puede tener hasta ${MAX} caracteres.` });
}

function validarQueja(cuerpo, idsCategoria) {
  const errores = [];
  const asunto = texto(cuerpo.asunto);
  const descripcion = texto(cuerpo.descripcion);
  const categoria = cuerpo.id_categoria_queja;
  const idCategoria = Number(categoria);
  const anonima = leerAnonima(cuerpo.anonima);

  if (categoria === undefined || categoria === null || categoria === "") {
    errores.push({ campo: "id_categoria_queja", mensaje: "Seleccione la categoría de la queja." });
  } else if (!idsCategoria.has(idCategoria)) {
    errores.push({ campo: "id_categoria_queja", mensaje: "La categoría seleccionada no existe." });
  }
  validarLargo(errores, "asunto", asunto, ASUNTO, { vacio: "Escriba el asunto de la queja.", nombre: "El asunto" });
  validarLargo(errores, "descripcion", descripcion, DESCRIPCION, {
    vacio: "Describa lo ocurrido.",
    nombre: "La descripción",
  });
  if (anonima === null) {
    errores.push({ campo: "anonima", mensaje: "Indique si desea enviar la queja de forma anónima." });
  }

  if (errores.length) throw new ErrorApp(400, "Revise los datos de la queja.", errores);
  return { asunto, descripcion, idCategoria, anonima };
}

module.exports = { ESTADO_QUEJA, ASUNTO, DESCRIPCION, ADJUNTOS, leerAnonima, validarQueja };
