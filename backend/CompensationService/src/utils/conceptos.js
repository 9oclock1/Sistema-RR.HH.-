const { ErrorApp } = require("./errores");
const { esFecha, diaAnterior } = require("./fechas");

const TIPOS = ["INGRESO", "DESCUENTO", "APORTE"];
const FORMAS = ["MONTO_FIJO", "PORCENTAJE"];
const BASES = ["HABER_BASICO", "TOTAL_GANADO"];

const CODIGO_RE = /^[A-Z0-9][A-Z0-9_-]{1,19}$/;
const CUENTA_RE = /^\d+(\.\d+)*$/;
const MONTO_MAXIMO = 9999999.99;

const texto = (valor) => (typeof valor === "string" ? valor.trim() : "");

function lanzarSiHayErrores(mensaje, errores) {
  if (errores.length > 0) throw new ErrorApp(400, mensaje, errores);
}

// Hasta 2 decimales en montos y 4 en porcentajes, para no perder precisión en la base de datos.
function validarValor(valor, forma) {
  if (typeof valor !== "number" || !Number.isFinite(valor) || valor <= 0) {
    return "Ingrese un valor mayor a 0.";
  }
  if (forma === "PORCENTAJE") {
    if (valor > 100) return "El porcentaje no puede ser mayor a 100.";
    if (!/^\d+(\.\d{1,4})?$/.test(String(valor))) return "Use hasta 4 decimales.";
  } else {
    if (valor > MONTO_MAXIMO) return "El monto es demasiado alto.";
    if (!/^\d+(\.\d{1,2})?$/.test(String(valor))) return "Use hasta 2 decimales.";
  }
  return null;
}

function validarDatosVigencia(datos, forma, errores) {
  const { valor, vigente_desde, vigente_hasta = null } = datos;
  const errorValor = validarValor(valor, forma);
  if (errorValor) errores.push({ campo: "valor", mensaje: errorValor });
  if (!esFecha(vigente_desde)) errores.push({ campo: "vigente_desde", mensaje: "Ingrese una fecha válida." });
  if (vigente_hasta !== null && vigente_hasta !== "") {
    if (!esFecha(vigente_hasta)) errores.push({ campo: "vigente_hasta", mensaje: "Ingrese una fecha válida." });
    else if (esFecha(vigente_desde) && vigente_hasta < vigente_desde) {
      errores.push({ campo: "vigente_hasta", mensaje: "Debe ser igual o posterior a la fecha de inicio." });
    }
  }
  return { valor, vigente_desde, vigente_hasta: vigente_hasta || null };
}

// Campos que se pueden editar después de crear el concepto.
function validarCamposEditables(datos, forma, errores) {
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const codigo = texto(datos.codigo).toUpperCase();
  const nombre = texto(datos.nombre);
  const descripcion = texto(datos.descripcion);
  const cuentaCodigo = texto(datos.cuenta_contable_codigo);
  const cuentaNombre = texto(datos.cuenta_contable_nombre);
  const { es_de_ley = false } = datos;
  const base_calculo = forma === "PORCENTAJE" ? datos.base_calculo : null;

  if (!CODIGO_RE.test(codigo)) {
    agregar("codigo", "Use de 2 a 20 letras, números, guiones o guion bajo, sin espacios.");
  }
  if (!nombre || nombre.length > 80) agregar("nombre", "Ingrese un nombre de hasta 80 caracteres.");
  if (descripcion.length > 250) agregar("descripcion", "Use hasta 250 caracteres.");
  if (forma === "PORCENTAJE" && !BASES.includes(base_calculo)) {
    agregar("base_calculo", "Seleccione sobre qué se calcula el porcentaje.");
  }
  if (typeof es_de_ley !== "boolean") agregar("es_de_ley", "Valor inválido.");
  if (cuentaCodigo && (!CUENTA_RE.test(cuentaCodigo) || cuentaCodigo.length > 20)) {
    agregar("cuenta_contable_codigo", "Use números separados por puntos, por ejemplo 2.1.3.01.");
  }
  if (cuentaNombre.length > 80) agregar("cuenta_contable_nombre", "Use hasta 80 caracteres.");
  if (cuentaCodigo && !cuentaNombre) agregar("cuenta_contable_nombre", "Ingrese el nombre de la cuenta.");
  if (!cuentaCodigo && cuentaNombre) agregar("cuenta_contable_codigo", "Ingrese el código de la cuenta.");

  return {
    codigo,
    nombre,
    descripcion: descripcion || null,
    base_calculo,
    es_de_ley,
    cuenta_contable_codigo: cuentaCodigo || null,
    cuenta_contable_nombre: cuentaNombre || null,
  };
}

function validarConcepto(datos = {}) {
  const errores = [];
  const { tipo, forma_calculo } = datos;
  if (!TIPOS.includes(tipo)) errores.push({ campo: "tipo", mensaje: "Seleccione ingreso, descuento o aporte." });
  if (!FORMAS.includes(forma_calculo)) {
    errores.push({ campo: "forma_calculo", mensaje: "Seleccione monto fijo o porcentaje." });
  }
  const editables = validarCamposEditables(datos, forma_calculo, errores);
  const vigencia = validarDatosVigencia(datos, forma_calculo, errores);
  lanzarSiHayErrores("Datos del concepto inválidos", errores);
  return { concepto: { ...editables, tipo, forma_calculo }, vigencia };
}

function validarEdicion(datos = {}, forma) {
  const errores = [];
  const editables = validarCamposEditables(datos, forma, errores);
  lanzarSiHayErrores("Datos del concepto inválidos", errores);
  return editables;
}

function validarVigencia(datos = {}, forma) {
  const errores = [];
  const vigencia = validarDatosVigencia(datos, forma, errores);
  lanzarSiHayErrores("Datos de la vigencia inválidos", errores);
  return vigencia;
}

// Una vigencia nueva debe empezar después de la última; si la última sigue abierta o se cruza, se cierra
// el día anterior. Su valor no se toca, así las planillas anteriores conservan el valor histórico.
function cierreDeUltima(ultima, nueva) {
  if (!ultima) return null;
  if (nueva.vigente_desde <= ultima.vigente_desde) {
    throw new ErrorApp(400, "Datos de la vigencia inválidos", [
      {
        campo: "vigente_desde",
        mensaje: `Debe ser posterior al inicio de la vigencia actual (${ultima.vigente_desde}).`,
      },
    ]);
  }
  const seCruza = ultima.vigente_hasta === null || ultima.vigente_hasta >= nueva.vigente_desde;
  return seCruza ? diaAnterior(nueva.vigente_desde) : null;
}

module.exports = {
  TIPOS,
  FORMAS,
  BASES,
  validarConcepto,
  validarEdicion,
  validarVigencia,
  cierreDeUltima,
};
