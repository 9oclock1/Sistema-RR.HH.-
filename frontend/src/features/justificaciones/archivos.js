export const MAX_ARCHIVOS = 3;
export const MAX_MB = 5;
const TIPOS = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };
const EXTENSIONES = { pdf: "application/pdf", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png" };

// Algunos sistemas no informan el tipo: se deduce por la extensión.
export const tipoDe = (archivo) =>
  TIPOS[archivo.type] ? archivo.type : EXTENSIONES[archivo.name.split(".").pop()?.toLowerCase()] ?? null;

export const claveDe = (archivo) => `${archivo.name}|${archivo.size}|${archivo.lastModified}`;

// Revisa los archivos nuevos contra los ya elegidos: devuelve los aceptados y por qué se descartó cada uno.
export function filtrarArchivos(actuales, nuevos) {
  const aceptados = [...actuales];
  const descartes = [];
  for (const archivo of nuevos) {
    if (!tipoDe(archivo)) descartes.push(`«${archivo.name}» no es PDF, JPG ni PNG.`);
    else if (archivo.size > MAX_MB * 1024 * 1024) descartes.push(`«${archivo.name}» pesa más de ${MAX_MB} MB.`);
    else if (archivo.size === 0) descartes.push(`«${archivo.name}» está vacío.`);
    else if (aceptados.some((a) => claveDe(a) === claveDe(archivo))) descartes.push(`«${archivo.name}» ya está en la lista.`);
    else if (aceptados.length >= MAX_ARCHIVOS) descartes.push(`«${archivo.name}» no se agregó: el máximo es ${MAX_ARCHIVOS} archivos.`);
    else aceptados.push(archivo);
  }
  return { aceptados, descartes };
}
