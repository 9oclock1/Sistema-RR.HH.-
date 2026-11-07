const { ErrorApp } = require("./errores");
const { aCentesimas } = require("./ponderacion");
const { TIPO_ESCALA, TIPO_COMPETENCIA } = require("./catalogos");

const MIN_NIVELES = 2;
const MAX_NIVELES = 10;
// NIVELES_ESCALA.valor es numeric(5, 2). El puntaje se calcula como valor / valor máximo × 100,
// por eso los valores no pueden ser negativos.
const MAX_VALOR_NIVEL = 999.99;

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
const esValorNivel = (valor) =>
  typeof valor === "number" &&
  Number.isFinite(valor) &&
  valor >= 0 &&
  valor <= MAX_VALOR_NIVEL &&
  Math.abs(aCentesimas(valor) - valor * 100) < 1e-6;

function validarNiveles(niveles, agregar) {
  if (!Array.isArray(niveles)) {
    agregar("niveles", "Defina los niveles de la escala.");
    return [];
  }
  if (niveles.length < MIN_NIVELES || niveles.length > MAX_NIVELES) {
    agregar("niveles", `Defina entre ${MIN_NIVELES} y ${MAX_NIVELES} niveles.`);
  }
  const etiquetas = new Set();
  const valores = new Set();
  const validos = niveles.map((nivel = {}, indice) => {
    const etiqueta = texto(nivel.etiqueta);
    const campo = `niveles[${indice}]`;
    if (!etiqueta || etiqueta.length > 60) agregar(`${campo}.etiqueta`, "Ingrese una etiqueta de hasta 60 caracteres.");
    else if (etiquetas.has(etiqueta.toLowerCase())) agregar(`${campo}.etiqueta`, "Las etiquetas no pueden repetirse.");
    if (!esValorNivel(nivel.valor)) {
      agregar(`${campo}.valor`, `Ingrese un número de 0 a ${MAX_VALOR_NIVEL}, con hasta dos decimales.`);
    } else if (valores.has(nivel.valor)) agregar(`${campo}.valor`, "Los valores no pueden repetirse.");
    etiquetas.add(etiqueta.toLowerCase());
    valores.add(nivel.valor);
    return { valor: nivel.valor, etiqueta };
  });
  return validos.sort((a, b) => a.valor - b.valor);
}

function validarEscala(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const nombre = texto(datos.nombre);
  const descripcion = texto(datos.descripcion) || null;
  const tipo = typeof datos.tipo === "string" ? datos.tipo.trim().toUpperCase() : "";

  if (!nombre || nombre.length > 80) agregar("nombre", "Ingrese un nombre de hasta 80 caracteres.");
  if (descripcion?.length > 255) agregar("descripcion", "Use hasta 255 caracteres.");
  if (!Object.hasOwn(TIPO_ESCALA, tipo)) agregar("tipo", "Seleccione si la escala es cuantitativa o cualitativa.");
  const niveles = validarNiveles(datos.niveles, agregar);

  if (errores.length > 0) throw new ErrorApp(400, "Datos de escala inválidos", errores);
  return { nombre, descripcion, id_tipo_escala: TIPO_ESCALA[tipo], niveles };
}

function validarCompetencia(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const nombre = texto(datos.nombre);
  const descripcion = texto(datos.descripcion) || null;
  const tipo = typeof datos.tipo === "string" ? datos.tipo.trim().toUpperCase() : "";

  if (!nombre || nombre.length > 100) agregar("nombre", "Ingrese un nombre de hasta 100 caracteres.");
  if (descripcion?.length > 255) agregar("descripcion", "Use hasta 255 caracteres.");
  if (!Object.hasOwn(TIPO_COMPETENCIA, tipo)) {
    agregar("tipo", "Seleccione si es una competencia laboral o un factor operativo.");
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos de competencia inválidos", errores);
  return { nombre, descripcion, id_tipo_competencia: TIPO_COMPETENCIA[tipo] };
}

module.exports = { validarEscala, validarCompetencia };
