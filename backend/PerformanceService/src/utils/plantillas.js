const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

const ESTADO_VERSION = { BORRADOR: 1, PUBLICADA: 2, ARCHIVADA: 3 };

const MAX_NOMBRE = 120;
const MAX_OBJETIVO = 1000;
const MAX_BUSQUEDA = 120;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const esTexto = (valor) => typeof valor === "string";

// Fecha del calendario en formato AAAA-MM-DD; rechaza fechas imposibles como 2027-02-30.
function esFechaValida(valor) {
  if (!esTexto(valor) || !FECHA_RE.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === valor;
}

function validarId(valor, campo = "id_plantilla") {
  if (!esTexto(valor) || !UUID_RE.test(valor))
    throw new ErrorApp(400, "Datos inválidos", [
      { campo, mensaje: "Debe ser un identificador válido." },
    ]);
  return valor.toLowerCase();
}

// Cabecera de la plantilla: nombre, área destino, objetivo y vigencia. Devuelve los datos limpios.
function validarCabecera(cuerpo) {
  const datos = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const errores = [];

  const nombre = esTexto(datos.nombre) ? datos.nombre.trim().replace(/\s+/g, " ") : "";
  if (!nombre) errores.push({ campo: "nombre", mensaje: "El nombre es obligatorio." });
  else if (nombre.length > MAX_NOMBRE)
    errores.push({ campo: "nombre", mensaje: `El nombre admite hasta ${MAX_NOMBRE} caracteres.` });

  const objetivo = esTexto(datos.objetivo) ? datos.objetivo.trim() : "";
  if (!objetivo) errores.push({ campo: "objetivo", mensaje: "El objetivo es obligatorio." });
  else if (objetivo.length > MAX_OBJETIVO)
    errores.push({ campo: "objetivo", mensaje: `El objetivo admite hasta ${MAX_OBJETIVO} caracteres.` });

  const idDepartamento = esTexto(datos.id_departamento) ? datos.id_departamento.toLowerCase() : "";
  if (!idDepartamento) errores.push({ campo: "id_departamento", mensaje: "El área destino es obligatoria." });
  else if (!UUID_RE.test(idDepartamento))
    errores.push({ campo: "id_departamento", mensaje: "El área destino debe ser un identificador válido." });

  const desdeValida = esFechaValida(datos.vigencia_desde);
  const hastaValida = esFechaValida(datos.vigencia_hasta);
  if (!desdeValida)
    errores.push({
      campo: "vigencia_desde",
      mensaje: datos.vigencia_desde ? "La fecha de inicio no es válida (AAAA-MM-DD)." : "La fecha de inicio de la vigencia es obligatoria.",
    });
  if (!hastaValida)
    errores.push({
      campo: "vigencia_hasta",
      mensaje: datos.vigencia_hasta ? "La fecha de fin no es válida (AAAA-MM-DD)." : "La fecha de fin de la vigencia es obligatoria.",
    });
  if (desdeValida && hastaValida && datos.vigencia_hasta < datos.vigencia_desde)
    errores.push({
      campo: "vigencia_hasta",
      mensaje: "La fecha de fin no puede ser anterior a la de inicio.",
    });

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return {
    nombre,
    objetivo,
    idDepartamento,
    vigenciaDesde: datos.vigencia_desde,
    vigenciaHasta: datos.vigencia_hasta,
  };
}

// Filtros del listado: estado de la versión más reciente, área y búsqueda por nombre.
function validarFiltros({ estado, id_departamento: idDepartamento, q } = {}) {
  const errores = [];
  let estados = null;
  let departamento = null;
  let busqueda = null;

  if (estado !== undefined && estado !== "") {
    const codigos = esTexto(estado) ? estado.split(",").map((codigo) => codigo.trim().toUpperCase()) : [];
    const invalidos = codigos.filter((codigo) => !Object.hasOwn(ESTADO_VERSION, codigo));
    if (codigos.length === 0 || invalidos.length > 0)
      errores.push({
        campo: "estado",
        mensaje: `El estado debe ser uno o varios de: ${Object.keys(ESTADO_VERSION).join(", ")}.`,
      });
    else estados = codigos.map((codigo) => ESTADO_VERSION[codigo]);
  }

  if (idDepartamento !== undefined && idDepartamento !== "") {
    if (esTexto(idDepartamento) && UUID_RE.test(idDepartamento)) departamento = idDepartamento.toLowerCase();
    else errores.push({ campo: "id_departamento", mensaje: "El área debe ser un identificador válido." });
  }

  if (q !== undefined && q !== "") {
    if (esTexto(q) && q.trim().length <= MAX_BUSQUEDA) busqueda = q.trim() || null;
    else errores.push({ campo: "q", mensaje: `La búsqueda admite hasta ${MAX_BUSQUEDA} caracteres.` });
  }

  if (errores.length > 0) throw new ErrorApp(400, "Datos inválidos", errores);
  return { estados, idDepartamento: departamento, busqueda };
}

module.exports = {
  ESTADO_VERSION,
  esFechaValida,
  validarId,
  validarCabecera,
  validarFiltros,
};
