const { ErrorApp } = require("./errores");

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MOTIVO = 500;

const esFecha = (valor) =>
  typeof valor === "string" && FECHA_RE.test(valor) && new Date(`${valor}T00:00:00Z`).toISOString().startsWith(valor);

// Acepta JSON o multipart: en multipart todos los valores llegan como texto.
function validarSolicitudLicencia(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const { fecha_inicio, fecha_fin } = datos;
  const idTipo = typeof datos.id_tipo_licencia === "string" ? datos.id_tipo_licencia.trim() : datos.id_tipo_licencia;
  const id_tipo_licencia = idTipo === "" || idTipo === null || idTipo === undefined ? NaN : Number(idTipo);
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";

  if (!Number.isInteger(id_tipo_licencia) || id_tipo_licencia <= 0) {
    agregar("id_tipo_licencia", "Seleccione el tipo de licencia.");
  }
  if (!esFecha(fecha_inicio)) agregar("fecha_inicio", "Ingrese una fecha válida (AAAA-MM-DD).");
  if (!esFecha(fecha_fin)) agregar("fecha_fin", "Ingrese una fecha válida (AAAA-MM-DD).");
  if (esFecha(fecha_inicio) && esFecha(fecha_fin) && fecha_fin < fecha_inicio) {
    agregar("fecha_fin", "No puede ser anterior a la fecha de inicio.");
  }
  if (motivo.length > MAX_MOTIVO) agregar("motivo", `Use hasta ${MAX_MOTIVO} caracteres.`);

  if (errores.length > 0) throw new ErrorApp(400, "Datos de solicitud inválidos", errores);

  return { id_tipo_licencia, fecha_inicio, fecha_fin, motivo: motivo || null };
}

module.exports = { validarSolicitudLicencia, MAX_MOTIVO };
