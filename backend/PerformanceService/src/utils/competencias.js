const { ErrorApp } = require("./errores");

const TIPO_COMPETENCIA = { COMPETENCIA_LABORAL: 1, FACTOR_OPERATIVO: 2 };

const MAX_NOMBRE = 100;
const MAX_DESCRIPCION = 255;

const esTexto = (valor) => typeof valor === "string";

function validarTipo(valor) {
  const codigo = esTexto(valor) ? valor.trim().toUpperCase() : "";
  return Object.hasOwn(TIPO_COMPETENCIA, codigo) ? codigo : null;
}

const mensajeTipo = `El tipo debe ser uno de: ${Object.keys(TIPO_COMPETENCIA).join(", ")}.`;

function validarCompetencia(cuerpo) {
  const datos = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const errores = [];

  const nombre = esTexto(datos.nombre) ? datos.nombre.trim().replace(/\s+/g, " ") : "";
  if (!nombre) errores.push({ campo: "nombre", mensaje: "El nombre es obligatorio." });
  else if (nombre.length > MAX_NOMBRE)
    errores.push({ campo: "nombre", mensaje: `El nombre admite hasta ${MAX_NOMBRE} caracteres.` });

  let descripcion = null;
  if (datos.descripcion !== undefined && datos.descripcion !== null && datos.descripcion !== "") {
    descripcion = esTexto(datos.descripcion) ? datos.descripcion.trim() : "";
    if (!descripcion || descripcion.length > MAX_DESCRIPCION) {
      errores.push({
        campo: "descripcion",
        mensaje: `La descripción debe tener entre 1 y ${MAX_DESCRIPCION} caracteres.`,
      });
    }
  }

  const tipo = validarTipo(datos.tipo);
  if (!tipo) errores.push({ campo: "tipo", mensaje: mensajeTipo });

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return { nombre, descripcion, idTipo: TIPO_COMPETENCIA[tipo] };
}

// Filtros del catálogo: por defecto solo las activas, que son las que se pueden poner en una sección.
function validarFiltros({ tipo, activas, q } = {}) {
  const errores = [];
  let idTipo = null;
  let soloActivas = true;
  let busqueda = null;

  if (tipo !== undefined && tipo !== "") {
    const codigo = validarTipo(tipo);
    if (codigo) idTipo = TIPO_COMPETENCIA[codigo];
    else errores.push({ campo: "tipo", mensaje: mensajeTipo });
  }

  if (activas !== undefined && activas !== "") {
    if (activas === "true" || activas === "false") soloActivas = activas === "true";
    else errores.push({ campo: "activas", mensaje: "Debe ser true o false." });
  }

  if (q !== undefined && q !== "") {
    if (esTexto(q) && q.trim().length <= MAX_NOMBRE) busqueda = q.trim() || null;
    else errores.push({ campo: "q", mensaje: `La búsqueda admite hasta ${MAX_NOMBRE} caracteres.` });
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return { idTipo, soloActivas, busqueda };
}

module.exports = { TIPO_COMPETENCIA, validarCompetencia, validarFiltros };
