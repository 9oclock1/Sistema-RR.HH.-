const { ErrorApp } = require("./errores");

// KAN-26: retroalimentación cualitativa final de una evaluación (fortalezas, aspectos de mejora,
// comentarios generales y compromisos de desarrollo con su fecha objetivo).

const CAMPOS_TEXTO = ["fortalezas", "aspectos_mejora", "comentarios_generales"];
const MAX_TEXTO = 4000;
const MAX_DESCRIPCION_COMPROMISO = 500;
const MAX_COMPROMISOS = 20;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const ETIQUETAS = {
  fortalezas: "Las fortalezas",
  aspectos_mejora: "Los aspectos de mejora",
  comentarios_generales: "Los comentarios generales",
};

// Fecha de calendario real (rechaza 2026-02-30).
function esFechaValida(texto) {
  if (typeof texto !== "string" || !FECHA_RE.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto;
}

// Texto opcional: se recorta y una cadena vacía se guarda como null.
function leerTexto(cuerpo, campo, errores) {
  const valor = cuerpo[campo];
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== "string") {
    errores.push({ campo, mensaje: `${ETIQUETAS[campo]} deben ser texto.` });
    return null;
  }
  const texto = valor.trim();
  if (texto.length > MAX_TEXTO) {
    errores.push({ campo, mensaje: `${ETIQUETAS[campo]} admiten hasta ${MAX_TEXTO} caracteres.` });
    return null;
  }
  return texto === "" ? null : texto;
}

// Valida la forma del cuerpo. La fecha mínima (hoy) se comprueba aparte, con la fecha de la base.
function validarRetroalimentacion(cuerpo) {
  if (!cuerpo || typeof cuerpo !== "object" || Array.isArray(cuerpo)) {
    throw new ErrorApp(400, "Datos inválidos", [
      { campo: "cuerpo", mensaje: "Envíe la retroalimentación como un objeto." },
    ]);
  }

  const errores = [];
  const textos = Object.fromEntries(CAMPOS_TEXTO.map((campo) => [campo, leerTexto(cuerpo, campo, errores)]));

  const lista = cuerpo.compromisos ?? [];
  const compromisos = [];
  if (!Array.isArray(lista)) {
    errores.push({ campo: "compromisos", mensaje: "Los compromisos deben ser una lista." });
  } else if (lista.length > MAX_COMPROMISOS) {
    errores.push({ campo: "compromisos", mensaje: `Puede registrar hasta ${MAX_COMPROMISOS} compromisos.` });
  } else {
    lista.forEach((item, posicion) => {
      const campo = `compromisos[${posicion}]`;
      const descripcion = typeof item?.descripcion === "string" ? item.descripcion.trim() : "";
      const fecha = item?.fecha_objetivo;
      let valido = true;

      if (descripcion === "") {
        errores.push({ campo: `${campo}.descripcion`, mensaje: "Describa el compromiso de desarrollo." });
        valido = false;
      } else if (descripcion.length > MAX_DESCRIPCION_COMPROMISO) {
        errores.push({
          campo: `${campo}.descripcion`,
          mensaje: `La descripción admite hasta ${MAX_DESCRIPCION_COMPROMISO} caracteres.`,
        });
        valido = false;
      }
      if (!esFechaValida(fecha)) {
        errores.push({
          campo: `${campo}.fecha_objetivo`,
          mensaje: "Indique la fecha objetivo de cumplimiento (AAAA-MM-DD).",
        });
        valido = false;
      }
      if (valido) compromisos.push({ descripcion, fechaObjetivo: fecha, posicion });
    });
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return { ...textos, compromisos };
}

// La fecha objetivo de un compromiso nuevo no puede estar en el pasado.
function verificarFechasCompromisos(compromisos, hoy) {
  const errores = compromisos
    .filter((compromiso) => compromiso.fechaObjetivo < hoy)
    .map((compromiso) => ({
      campo: `compromisos[${compromiso.posicion}].fecha_objetivo`,
      mensaje: "La fecha objetivo no puede ser anterior a hoy.",
    }));
  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
}

// Forma pública de la retroalimentación, igual para el evaluador y el colaborador.
const describirRetroalimentacion = (evaluacion, compromisos) => ({
  fortalezas: evaluacion.fortalezas ?? null,
  aspectos_mejora: evaluacion.aspectos_mejora ?? null,
  comentarios_generales: evaluacion.comentarios_generales ?? null,
  compromisos: compromisos.map(({ id_compromiso, descripcion, fecha_objetivo }) => ({
    id_compromiso,
    descripcion,
    fecha_objetivo,
  })),
});

module.exports = {
  MAX_TEXTO,
  MAX_DESCRIPCION_COMPROMISO,
  MAX_COMPROMISOS,
  validarRetroalimentacion,
  verificarFechasCompromisos,
  describirRetroalimentacion,
};
