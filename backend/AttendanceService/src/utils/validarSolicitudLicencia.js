const { ErrorApp } = require("./errores");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MOTIVO = 500;

// SMALLINT máximo de la columna dias_solicitados; 365 días cubre cualquier licencia razonable.
const MAX_DIAS_SOLICITUD = 365;
const ID_TIPO_RE = /^\d{1,5}$/;
const ID_TIPO_MAX = 32767;

function esFecha(valor) {
  if (typeof valor !== "string" || !FECHA_RE.test(valor)) return false;
  const tiempo = Date.parse(`${valor}T00:00:00Z`);
  // Una fecha como 2035-13-01 da NaN; 2027-02-30 se corrige sola y deja de coincidir.
  return !Number.isNaN(tiempo) && new Date(tiempo).toISOString().startsWith(valor);
}

const aIdTipo = (valor) => {
  if (typeof valor === "number") return valor;
  return typeof valor === "string" && ID_TIPO_RE.test(valor.trim()) ? Number(valor.trim()) : NaN;
};

// Acepta JSON o multipart: en multipart todos los valores llegan como texto.
function validarSolicitudLicencia(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const { fecha_inicio, fecha_fin } = datos;
  const id_tipo_licencia = aIdTipo(datos.id_tipo_licencia);
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";

  if (!Number.isInteger(id_tipo_licencia) || id_tipo_licencia <= 0 || id_tipo_licencia > ID_TIPO_MAX) {
    agregar("id_tipo_licencia", "Seleccione el tipo de licencia.");
  }
  if (!esFecha(fecha_inicio)) agregar("fecha_inicio", "Ingrese una fecha válida (AAAA-MM-DD).");
  if (!esFecha(fecha_fin)) agregar("fecha_fin", "Ingrese una fecha válida (AAAA-MM-DD).");
  if (esFecha(fecha_inicio) && esFecha(fecha_fin) && fecha_fin < fecha_inicio) {
    agregar("fecha_fin", "No puede ser anterior a la fecha de inicio.");
  }
  if (
    esFecha(fecha_inicio) &&
    esFecha(fecha_fin) &&
    fecha_fin >= fecha_inicio &&
    (Date.parse(`${fecha_fin}T00:00:00Z`) - Date.parse(`${fecha_inicio}T00:00:00Z`)) / 86400000 + 1 > MAX_DIAS_SOLICITUD
  ) {
    agregar("fecha_fin", `El rango no puede superar ${MAX_DIAS_SOLICITUD} días.`);
  }
  if (motivo.length > MAX_MOTIVO) agregar("motivo", `Use hasta ${MAX_MOTIVO} caracteres.`);

  if (errores.length > 0) throw new ErrorApp(400, "Datos de solicitud inválidos", errores);

  return { id_tipo_licencia, fecha_inicio, fecha_fin, motivo: motivo || null };
}

module.exports = { validarSolicitudLicencia, MAX_MOTIVO, MAX_DIAS_SOLICITUD };
