export const RUTA_HISTORIAL_QUEJAS = "/desempeno/historial-quejas";
export const rutaHistorialQueja = (idQueja) => `${RUTA_HISTORIAL_QUEJAS}/${idQueja}`;

export const SIN_SUCURSAL = "sin";
export const MENSAJE_SIN_PERMISO = "Solo el Administrador de RRHH y el Auditor pueden consultar el historial de quejas.";

const dias = new Intl.NumberFormat("es-BO", { maximumFractionDigits: 1 });

export function formatearDuracion(valor) {
  if (valor === null || valor === undefined) return "Sin dato";
  return `${dias.format(valor)} ${valor === 1 ? "día" : "días"}`;
}

export function validarRango({ desde, hasta }) {
  if (desde && hasta && desde > hasta) return { hasta: "La fecha final no puede ser anterior a la inicial." };
  return {};
}

const fechaArchivo = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" });

export const nombreExportacion = (fecha = new Date()) =>
  `historial-quejas-${fechaArchivo.format(fecha).replaceAll("-", "")}.csv`;

export function descargarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
