const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { aCentesimas } = require("./ponderacion");

const MAX_SECCIONES = 20;
const MAX_CRITERIOS = 30;
const MAX_PREGUNTAS = 50;
const MAX_OBJETIVO = 2000;
const MAX_TEXTO_PREGUNTA = 500;

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
const esNumero = (valor) => typeof valor === "number" && Number.isFinite(valor);
const conDosDecimales = (valor) => Math.abs(aCentesimas(valor) - valor * 100) < 1e-6;
const uuid = (valor) => (typeof valor === "string" && UUID_RE.test(valor) ? valor.toLowerCase() : null);

// Fecha de calendario en formato AAAA-MM-DD.
function fecha(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const dia = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === valor ? valor : null;
}

// Datos base de PLANTILLAS_EVALUACION: nombre, área destino, objetivo y vigencia.
function validarDatosBase(datos, agregar) {
  const nombre = texto(datos.nombre);
  const objetivo = texto(datos.objetivo);
  const idDepartamento = uuid(datos.id_departamento_destino);
  const desde = fecha(datos.vigencia_desde);
  const hasta = fecha(datos.vigencia_hasta);

  if (!nombre || nombre.length > 120) agregar("nombre", "Ingrese un nombre de hasta 120 caracteres.");
  if (!objetivo || objetivo.length > MAX_OBJETIVO) {
    agregar("objetivo", `Ingrese el objetivo de la evaluación, de hasta ${MAX_OBJETIVO} caracteres.`);
  }
  if (!idDepartamento) agregar("id_departamento_destino", "Seleccione el área a la que va dirigida.");
  if (!desde) agregar("vigencia_desde", "Ingrese una fecha válida.");
  if (!hasta) agregar("vigencia_hasta", "Ingrese una fecha válida.");
  else if (desde && hasta < desde) agregar("vigencia_hasta", "Debe ser igual o posterior al inicio de la vigencia.");

  return {
    nombre,
    objetivo,
    id_departamento_destino: idDepartamento,
    vigencia_desde: desde,
    vigencia_hasta: hasta,
  };
}

function validarPregunta(pregunta = {}, ruta, agregar) {
  const textoPregunta = texto(pregunta.texto);
  if (!textoPregunta || textoPregunta.length > MAX_TEXTO_PREGUNTA) {
    agregar(`${ruta}.texto`, `Ingrese el texto de la pregunta, de hasta ${MAX_TEXTO_PREGUNTA} caracteres.`);
  }
  const peso = pregunta.peso_porcentual;
  if (!esNumero(peso) || peso <= 0 || peso > 100 || !conDosDecimales(peso)) {
    agregar(`${ruta}.peso_porcentual`, "Ingrese un porcentaje mayor a 0 y hasta 100, con hasta dos decimales.");
  }
  const { es_obligatoria: obligatoria = true } = pregunta;
  if (typeof obligatoria !== "boolean") agregar(`${ruta}.es_obligatoria`, "Indique si la pregunta es obligatoria.");
  const idEscala = uuid(pregunta.id_escala);
  if (!idEscala) agregar(`${ruta}.id_escala`, "Seleccione una escala de valoración.");
  return { texto: textoPregunta, peso_porcentual: peso, es_obligatoria: obligatoria, id_escala: idEscala };
}

function validarCriterio(criterio = {}, ruta, agregar) {
  const nombre = texto(criterio.nombre);
  const descripcion = texto(criterio.descripcion) || null;
  if (!nombre || nombre.length > 120) agregar(`${ruta}.nombre`, "Ingrese un nombre de hasta 120 caracteres.");
  if (descripcion?.length > 255) agregar(`${ruta}.descripcion`, "Use hasta 255 caracteres.");

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

function validarSeccion(seccion = {}, ruta, agregar) {
  const idCompetencia = uuid(seccion.id_competencia);
  if (!idCompetencia) agregar(`${ruta}.id_competencia`, "Seleccione la competencia que evalúa la sección.");

  const { criterios = [] } = seccion;
  if (!Array.isArray(criterios)) {
    agregar(`${ruta}.criterios`, "Los criterios deben ser una lista.");
    return { id_competencia: idCompetencia, criterios: [] };
  }
  if (criterios.length > MAX_CRITERIOS) agregar(`${ruta}.criterios`, `Use hasta ${MAX_CRITERIOS} criterios por sección.`);
  const validos = criterios.map((criterio, indice) => validarCriterio(criterio, `${ruta}.criterios[${indice}]`, agregar));
  const nombres = new Set();
  validos.forEach(({ nombre }, indice) => {
    const clave = nombre.toLowerCase();
    if (clave && nombres.has(clave)) {
      agregar(`${ruta}.criterios[${indice}].nombre`, "Ya existe un criterio con ese nombre en la sección.");
    }
    nombres.add(clave);
  });
  return { id_competencia: idCompetencia, criterios: validos };
}

function validarSecciones(secciones, agregar) {
  if (!Array.isArray(secciones)) {
    agregar("secciones", "Las secciones deben ser una lista.");
    return [];
  }
  if (secciones.length > MAX_SECCIONES) agregar("secciones", `Use hasta ${MAX_SECCIONES} secciones.`);
  const validas = secciones.map((seccion, indice) => validarSeccion(seccion, `secciones[${indice}]`, agregar));
  const competencias = new Set();
  validas.forEach(({ id_competencia: id }, indice) => {
    if (id && competencias.has(id)) {
      agregar(`secciones[${indice}].id_competencia`, "Esa competencia ya tiene una sección en la plantilla.");
    }
    competencias.add(id);
  });
  return validas;
}

// Valida los datos base y la estructura de una versión. La suma de pesos no se exige aquí: un borrador
// puede guardarse desbalanceado y el balance se controla al publicar.
// Con conDatosBase = false solo valida la estructura (los datos base ya no se pueden cambiar).
function validarPlantilla(datos = {}, { conDatosBase = true } = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const base = conDatosBase ? validarDatosBase(datos, agregar) : {};
  const secciones = validarSecciones(datos.secciones ?? [], agregar);
  if (errores.length > 0) throw new ErrorApp(400, "Datos de plantilla inválidos", errores);
  return { ...base, secciones };
}

module.exports = { validarPlantilla };
