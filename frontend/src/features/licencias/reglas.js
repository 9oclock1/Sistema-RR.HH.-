export const MAX_ARCHIVOS = 5;
export const MAX_MB = 5;
export const TIPOS_PERMITIDOS = ["application/pdf", "image/jpeg", "image/png"];
export const ACEPTAR = ".pdf,.jpg,.jpeg,.png";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const fecha = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", dateStyle: "medium" });

export const formatearFecha = (aaaaMmDd) => fecha.format(new Date(`${aaaaMmDd}T00:00:00Z`));

// Días corridos con ambos extremos incluidos; 0 mientras el rango esté incompleto o invertido.
export function contarDias(inicio, fin) {
  if (!inicio || !fin) return 0;
  const dias = Math.round((Date.parse(`${fin}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / MS_POR_DIA) + 1;
  return dias > 0 ? dias : 0;
}

export const excedeLimite = (tipo, dias) =>
  Boolean(tipo) && tipo.dias_maximos_continuos !== null && dias > tipo.dias_maximos_continuos;

// Devuelve el error de un archivo candidato o null si se puede adjuntar.
export function errorDeArchivo(archivo, yaAdjuntos) {
  if (yaAdjuntos >= MAX_ARCHIVOS) return `Puede adjuntar hasta ${MAX_ARCHIVOS} archivos.`;
  if (!TIPOS_PERMITIDOS.includes(archivo.type)) return "Formato no permitido. Use PDF, JPG o PNG.";
  if (archivo.size > MAX_MB * 1024 * 1024) return `«${archivo.name}» supera los ${MAX_MB} MB.`;
  return null;
}

// Mismas reglas que el servidor, para avisar antes de enviar.
export function validarFormulario(valores, tipo, archivos) {
  const errores = {};
  if (!tipo) errores.id_tipo_licencia = "Seleccione el tipo de licencia.";
  if (!valores.fecha_inicio) errores.fecha_inicio = "Ingrese la fecha de inicio.";
  if (!valores.fecha_fin) errores.fecha_fin = "Ingrese la fecha de fin.";
  if (valores.fecha_inicio && valores.fecha_fin && valores.fecha_fin < valores.fecha_inicio) {
    errores.fecha_fin = "No puede ser anterior a la fecha de inicio.";
  }
  if (tipo?.requiere_adjunto && archivos.length === 0) {
    errores.archivos = `La licencia «${tipo.nombre}» exige adjuntar el respaldo digital.`;
  }
  return errores;
}
