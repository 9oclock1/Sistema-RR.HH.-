const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");

// Id fijo de CATALOGOS_MODULO_EXTERNO (catalogos.sql): destino de la solicitud de métricas al cerrar un ciclo.
const MODULO_EXTERNO = { CRM: 1 };

const MAX_NOMBRE = 120;
const MAX_ELEMENTOS_ALCANCE = 500;

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");
const uuid = (valor) => (typeof valor === "string" && UUID_RE.test(valor) ? valor.toLowerCase() : null);

// Fecha de calendario en formato AAAA-MM-DD.
function fecha(valor) {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null;
  const dia = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(dia.getTime()) && dia.toISOString().slice(0, 10) === valor ? valor : null;
}

function listaDeIds(valor, campo, agregar) {
  if (valor === undefined || valor === null) return [];
  if (!Array.isArray(valor)) {
    agregar(campo, "Debe ser una lista de identificadores.");
    return [];
  }
  if (valor.length > MAX_ELEMENTOS_ALCANCE) {
    agregar(campo, `Puede elegir hasta ${MAX_ELEMENTOS_ALCANCE} elementos.`);
    return [];
  }
  const ids = [];
  valor.forEach((item, posicion) => {
    const id = uuid(item);
    if (id) ids.push(id);
    else agregar(`${campo}[${posicion}]`, "Debe ser un identificador válido.");
  });
  return [...new Set(ids)];
}

// Alcance del ciclo: áreas, sucursales y colaboradores elegidos. Debe haber al menos uno.
function validarAlcance(alcance, agregar) {
  const datos = alcance && typeof alcance === "object" && !Array.isArray(alcance) ? alcance : {};
  const resultado = {
    areas: listaDeIds(datos.areas, "alcance.areas", agregar),
    sucursales: listaDeIds(datos.sucursales, "alcance.sucursales", agregar),
    colaboradores: listaDeIds(datos.colaboradores, "alcance.colaboradores", agregar),
  };
  if (resultado.areas.length + resultado.sucursales.length + resultado.colaboradores.length === 0) {
    agregar("alcance", "Seleccione al menos un área, una sucursal o un colaborador.");
  }
  return resultado;
}

function recolector() {
  const errores = [];
  return { errores, agregar: (campo, mensaje) => errores.push({ campo, mensaje }) };
}

function lanzarSiHayErrores(errores, mensaje) {
  if (errores.length > 0) throw new ErrorApp(400, mensaje, errores);
}

// Cuerpo de POST /ciclos.
function validarCiclo(cuerpo) {
  const datos = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const { errores, agregar } = recolector();

  const idVersion = uuid(datos.id_version);
  const idPeriodo = uuid(datos.id_periodo);
  const nombre = texto(datos.nombre);
  const fechaInicio = fecha(datos.fecha_inicio);
  const fechaLimite = fecha(datos.fecha_limite);

  if (!idVersion) agregar("id_version", "Seleccione la plantilla publicada que se usará.");
  if (!idPeriodo) agregar("id_periodo", "Seleccione el periodo de evaluación.");
  if (!nombre || nombre.length > MAX_NOMBRE) agregar("nombre", `Ingrese un nombre de hasta ${MAX_NOMBRE} caracteres.`);
  if (!fechaInicio) agregar("fecha_inicio", "Ingrese una fecha válida.");
  if (!fechaLimite) agregar("fecha_limite", "Ingrese una fecha válida.");
  else if (fechaInicio && fechaLimite < fechaInicio) {
    agregar("fecha_limite", "Debe ser igual o posterior a la fecha de inicio.");
  }
  const alcance = validarAlcance(datos.alcance, agregar);

  lanzarSiHayErrores(errores, "Datos de ciclo inválidos");
  return { idVersion, idPeriodo, nombre, fechaInicio, fechaLimite, alcance };
}

// Cuerpo de POST /ciclos/vista-previa: solo el alcance, y opcionalmente la versión para avisar de otras áreas.
function validarVistaPrevia(cuerpo) {
  const datos = cuerpo && typeof cuerpo === "object" ? cuerpo : {};
  const { errores, agregar } = recolector();

  let idVersion = null;
  if (datos.id_version !== undefined && datos.id_version !== null && datos.id_version !== "") {
    idVersion = uuid(datos.id_version);
    if (!idVersion) agregar("id_version", "Debe ser un identificador válido.");
  }
  const alcance = validarAlcance(datos.alcance, agregar);

  lanzarSiHayErrores(errores, "Datos de alcance inválidos");
  return { idVersion, alcance };
}

// Reglas de fechas que dependen del periodo y del día de hoy (en La Paz). Devuelve la lista de errores.
// El límite puede pasar el fin del periodo: se evalúa cuando el periodo ya terminó.
function verificarFechas({ fechaInicio, fechaLimite }, periodo, hoy) {
  const errores = [];
  if (fechaInicio < hoy) errores.push({ campo: "fecha_inicio", mensaje: "La fecha de inicio no puede ser anterior a hoy." });
  if (periodo && fechaInicio < periodo.fecha_inicio) {
    errores.push({
      campo: "fecha_inicio",
      mensaje: `La fecha de inicio no puede ser anterior al inicio del periodo «${periodo.nombre}» (${periodo.fecha_inicio}).`,
    });
  }
  if (fechaLimite < hoy) errores.push({ campo: "fecha_limite", mensaje: "La fecha límite no puede ser anterior a hoy." });
  return errores;
}

module.exports = { MODULO_EXTERNO, MAX_ELEMENTOS_ALCANCE, validarCiclo, validarVistaPrevia, verificarFechas };
