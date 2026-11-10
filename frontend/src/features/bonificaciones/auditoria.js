export const RUTA_AUDITORIA_BONOS = "/planillas/auditoria-bonos";

export const MENSAJE_SIN_PERMISO = "Solo el Administrador de RRHH y el Auditor pueden consultar la auditoría de bonificaciones.";

export const TONOS_ACCION = {
  ALTA: "exito",
  MODIFICACION: "aviso",
  ANULACION: "peligro",
};

export const ETIQUETAS_ACCION = {
  ALTA: "Alta",
  MODIFICACION: "Modificación",
  ANULACION: "Anulación",
};

export const ETIQUETAS_TIPO_BONO = {
  CONDICION: "Condición especial",
  PRODUCTIVIDAD: "Productividad",
  ANTIGUEDAD: "Antigüedad",
};

// Una sola fila trae o bien valor o bien monto, nunca ambos (depende de la forma de cálculo del bono).
export const describirCambio = (fila) => {
  const anterior = fila.monto.anterior ?? fila.valor.anterior;
  const nuevo = fila.monto.nuevo ?? fila.valor.nuevo;
  const formatear = (n) => (n === null || n === undefined ? "—" : fila.monto.anterior !== null || fila.monto.nuevo !== null ? `Bs ${Number(n).toFixed(2)}` : `${n}%`);
  return `${formatear(anterior)} → ${formatear(nuevo)}`;
};

const fechaHora = new Intl.DateTimeFormat("es-BO", { dateStyle: "short", timeStyle: "short", timeZone: "America/La_Paz" });

export const formatearFechaHora = (iso) => fechaHora.format(new Date(iso));

const fechaArchivo = new Intl.DateTimeFormat("en-CA", { timeZone: "America/La_Paz" });

export const nombreExportacionAuditoria = (fecha = new Date()) =>
  `auditoria-bonos-${fechaArchivo.format(fecha).replaceAll("-", "")}.csv`;

export function guardarComo(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}
