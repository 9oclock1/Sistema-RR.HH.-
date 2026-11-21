export const ESTADOS = {
  INICIADO: { etiqueta: "Iniciado", tono: "info" },
  EN_CURSO: { etiqueta: "En curso", tono: "morado" },
  CERRADO: { etiqueta: "Cerrado", tono: "exito" },
  ANULADO: { etiqueta: "Anulado", tono: "neutral" },
};

export const MAX_MB = 5;
const TIPOS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const EXTENSIONES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

export const opciones = (catalogo) =>
  Object.entries(catalogo).map(([valor, { etiqueta }]) => ({ valor, etiqueta }));

export const formatearFecha = (fecha) => (fecha ? fecha.split("-").reverse().join("/") : "—");

export const formatearFechaHora = (iso) => {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleDateString("es-BO", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export const formatearTamano = (bytes) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const hoyLaPaz = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" }).format(new Date());

export const tipoArchivoDe = (archivo) =>
  TIPOS[archivo.type] ? archivo.type : EXTENSIONES[archivo.name.split(".").pop()?.toLowerCase()] ?? null;

export function validarArchivoRespaldo(archivo) {
  if (!archivo) return "Adjunte el documento de respaldo (PDF, JPG o PNG).";
  if (!tipoArchivoDe(archivo)) return `«${archivo.name}» no es PDF, JPG ni PNG.`;
  if (archivo.size === 0) return `«${archivo.name}» está vacío.`;
  if (archivo.size > MAX_MB * 1024 * 1024) return `«${archivo.name}» pesa más de ${MAX_MB} MB.`;
  return null;
}
