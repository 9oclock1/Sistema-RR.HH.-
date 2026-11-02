const { ErrorApp } = require("./errores");
const { aCentesimas } = require("./ponderacion");

const TIPOS_ESCALA = ["LIKERT", "NUMERICA", "CUALITATIVA"];
const VALORES_LIKERT = [1, 2, 3, 4, 5];
const MAX_CRITERIOS = 30;
const MAX_PREGUNTAS = 50;
const MIN_NIVELES = 2;
const MAX_NIVELES = 10;
const MAX_VALOR_ESCALA = 99999.99;

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
const esNumero = (valor) => typeof valor === "number" && Number.isFinite(valor);
const conDosDecimales = (valor) => Math.abs(aCentesimas(valor) - valor * 100) < 1e-6;
const esValorEscala = (valor) => esNumero(valor) && Math.abs(valor) <= MAX_VALOR_ESCALA && conDosDecimales(valor);

function validarNiveles(niveles, ruta, agregar) {
  if (!Array.isArray(niveles)) {
    agregar(`${ruta}.niveles`, "Defina los niveles de la escala.");
    return [];
  }
  const etiquetas = new Set();
  const valores = new Set();
  const validos = niveles.map((nivel = {}, indice) => {
    const etiqueta = texto(nivel.etiqueta);
    const campo = `${ruta}.niveles[${indice}]`;
    if (!etiqueta || etiqueta.length > 80) agregar(`${campo}.etiqueta`, "Ingrese una etiqueta de hasta 80 caracteres.");
    else if (etiquetas.has(etiqueta.toLowerCase())) agregar(`${campo}.etiqueta`, "Las etiquetas no pueden repetirse.");
    if (!esValorEscala(nivel.valor)) agregar(`${campo}.valor`, "Ingrese un número con hasta dos decimales.");
    else if (valores.has(nivel.valor)) agregar(`${campo}.valor`, "Los valores no pueden repetirse.");
    etiquetas.add(etiqueta.toLowerCase());
    valores.add(nivel.valor);
    return { valor: nivel.valor, etiqueta };
  });
  return validos.sort((a, b) => a.valor - b.valor);
}

// Devuelve la escala normalizada: rango y niveles con su etiqueta.
function validarEscala(pregunta, ruta, agregar) {
  const { tipo_escala } = pregunta;
  if (!TIPOS_ESCALA.includes(tipo_escala)) {
    agregar(`${ruta}.tipo_escala`, "Seleccione un tipo de escala.");
    return {};
  }

  if (tipo_escala === "NUMERICA") {
    const { valor_minimo, valor_maximo } = pregunta;
    if (!esValorEscala(valor_minimo)) agregar(`${ruta}.valor_minimo`, "Ingrese un número con hasta dos decimales.");
    if (!esValorEscala(valor_maximo)) agregar(`${ruta}.valor_maximo`, "Ingrese un número con hasta dos decimales.");
    else if (esValorEscala(valor_minimo) && valor_maximo <= valor_minimo) {
      agregar(`${ruta}.valor_maximo`, "Debe ser mayor al valor mínimo.");
    }
    return { tipo_escala, valor_minimo, valor_maximo, niveles: [] };
  }

  const niveles = validarNiveles(pregunta.niveles, ruta, agregar);
  if (tipo_escala === "LIKERT") {
    const completa =
      niveles.length === VALORES_LIKERT.length && niveles.every((nivel, indice) => nivel.valor === VALORES_LIKERT[indice]);
    if (!completa) agregar(`${ruta}.niveles`, "La escala Likert necesita una etiqueta para cada nivel del 1 al 5.");
    return { tipo_escala, valor_minimo: 1, valor_maximo: 5, niveles };
  }

  if (niveles.length < MIN_NIVELES || niveles.length > MAX_NIVELES) {
    agregar(`${ruta}.niveles`, `Defina entre ${MIN_NIVELES} y ${MAX_NIVELES} niveles.`);
  }
  return {
    tipo_escala,
    valor_minimo: niveles[0]?.valor,
    valor_maximo: niveles.at(-1)?.valor,
    niveles,
  };
}

function validarPregunta(pregunta = {}, ruta, agregar) {
  const enunciado = texto(pregunta.enunciado);
  if (!enunciado || enunciado.length > 500) agregar(`${ruta}.enunciado`, "Ingrese un enunciado de hasta 500 caracteres.");
  const { peso } = pregunta;
  if (!esNumero(peso) || peso <= 0 || peso > 100 || !conDosDecimales(peso)) {
    agregar(`${ruta}.peso`, "Ingrese un porcentaje mayor a 0 y hasta 100, con hasta dos decimales.");
  }
  return { enunciado, peso, ...validarEscala(pregunta, ruta, agregar) };
}

function validarCriterio(criterio = {}, ruta, agregar) {
  const nombre = texto(criterio.nombre);
  const descripcion = texto(criterio.descripcion) || null;
  if (!nombre || nombre.length > 120) agregar(`${ruta}.nombre`, "Ingrese un nombre de hasta 120 caracteres.");
  if (descripcion?.length > 500) agregar(`${ruta}.descripcion`, "Use hasta 500 caracteres.");

  const { preguntas = [] } = criterio;
  if (!Array.isArray(preguntas)) {
    agregar(`${ruta}.preguntas`, "Las preguntas deben ser una lista.");
    return { nombre, descripcion, preguntas: [] };
  }
  if (preguntas.length > MAX_PREGUNTAS) agregar(`${ruta}.preguntas`, `Use hasta ${MAX_PREGUNTAS} preguntas por criterio.`);
  return {
    nombre,
    descripcion,
    preguntas: preguntas.map((pregunta, indice) => validarPregunta(pregunta, `${ruta}.preguntas[${indice}]`, agregar)),
  };
}

// Valida la estructura de una plantilla. La suma de pesos no se exige aquí: un borrador puede
// guardarse desbalanceado y el balance se controla al publicar.
function validarPlantilla(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const nombre = texto(datos.nombre);
  const descripcion = texto(datos.descripcion) || null;
  const { criterios = [] } = datos;

  if (!nombre || nombre.length > 120) agregar("nombre", "Ingrese un nombre de hasta 120 caracteres.");
  if (descripcion?.length > 500) agregar("descripcion", "Use hasta 500 caracteres.");

  let criteriosValidos = [];
  if (!Array.isArray(criterios)) agregar("criterios", "Los criterios deben ser una lista.");
  else {
    if (criterios.length > MAX_CRITERIOS) agregar("criterios", `Use hasta ${MAX_CRITERIOS} criterios.`);
    criteriosValidos = criterios.map((criterio, indice) => validarCriterio(criterio, `criterios[${indice}]`, agregar));
    const nombres = new Set();
    criteriosValidos.forEach(({ nombre: nombreCriterio }, indice) => {
      const clave = nombreCriterio.toLowerCase();
      if (clave && nombres.has(clave)) agregar(`criterios[${indice}].nombre`, "Ya existe un criterio con ese nombre.");
      nombres.add(clave);
    });
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos de plantilla inválidos", errores);

  return { nombre, descripcion, criterios: criteriosValidos };
}

module.exports = { validarPlantilla, TIPOS_ESCALA };
