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

export const formatearBs = (valor) => {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return `Bs ${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export const formatearPeriodo = (periodo) => {
  if (!periodo || typeof periodo !== "string") return "—";
  const [anio, mesStr] = periodo.split("-");
  const mes = Number(mesStr);
  if (!anio || !mes || mes < 1 || mes > 12) return periodo;
  return `${MESES[mes - 1]} ${anio}`;
};

const contar = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;

// "5 años, 3 meses y 10 días (1928 días)"; omite las partes en cero.
export const formatearTiempoServicio = (tiempo) => {
  if (!tiempo) return "—";
  const partes = [
    tiempo.anios > 0 && contar(tiempo.anios, "año", "años"),
    tiempo.meses > 0 && contar(tiempo.meses, "mes", "meses"),
    tiempo.dias > 0 && contar(tiempo.dias, "día", "días"),
  ].filter(Boolean);
  const texto = partes.length > 1 ? `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}` : partes[0] ?? "0 días";
  return `${texto} (${contar(tiempo.dias_servicio, "día", "días")})`;
};

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

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export function validarFormularioDesvinculacion(valores = {}) {
  const errores = {};
  if (!String(valores.id_empleado ?? "").trim()) {
    errores.id_empleado = "Seleccione el colaborador.";
  }
  if (!String(valores.codigo_causal ?? "").trim()) {
    errores.codigo_causal = "Seleccione la causal de desvinculación.";
  }

  const fecha = valores.fecha_retiro;
  const hoy = hoyLaPaz();
  if (typeof fecha !== "string" || !FECHA_RE.test(fecha)) {
    errores.fecha_retiro = "Ingrese una fecha de retiro válida.";
  } else if (fecha > hoy) {
    errores.fecha_retiro = `No puede ser posterior a hoy (${hoy}).`;
  }

  const obs = typeof valores.observaciones === "string" ? valores.observaciones.trim() : "";
  if (obs.length > 500) {
    errores.observaciones = "Use hasta 500 caracteres.";
  }

  const errorArchivo = validarArchivoRespaldo(valores.documento);
  if (errorArchivo) {
    errores.documento = errorArchivo;
  }

  return errores;
}
