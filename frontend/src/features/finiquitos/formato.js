export const ESTADOS_FINIQUITO = {
  SIN_GENERAR: { etiqueta: "Sin generar", tono: "neutral" },
  BORRADOR: { etiqueta: "Borrador", tono: "aviso" },
  APROBADO: { etiqueta: "Aprobado", tono: "info" },
  PAGADO: { etiqueta: "Pagado", tono: "exito" },
};

export const ESTADOS_RESPUESTA = {
  PENDIENTE: { etiqueta: "Pendiente", tono: "aviso" },
  CONFIRMADA: { etiqueta: "Confirmada", tono: "exito" },
  RECHAZADA: { etiqueta: "Rechazada", tono: "peligro" },
};

export const ESTADOS_ENVIO = {
  PENDIENTE: { etiqueta: "Pendiente", tono: "aviso" },
  ENTREGADO: { etiqueta: "Enviado", tono: "exito" },
  FALLIDO: { etiqueta: "Fallido", tono: "peligro" },
};

export const ESTADOS_MENSAJE = {
  RECIBIDO: { etiqueta: "Recibido", tono: "info" },
  PROCESADO: { etiqueta: "Procesado", tono: "exito" },
  IGNORADO: { etiqueta: "Ignorado", tono: "neutral" },
  EN_DLQ: { etiqueta: "En cola de errores", tono: "peligro" },
};

export const opciones = (catalogo) =>
  Object.entries(catalogo).map(([valor, { etiqueta }]) => ({ valor, etiqueta }));

export const formatearFecha = (fecha) => (fecha ? String(fecha).slice(0, 10).split("-").reverse().join("/") : "—");

export const formatearBs = (valor) => {
  if (valor === null || valor === undefined || Number.isNaN(Number(valor))) return "—";
  return `Bs ${Number(valor).toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export const formatearFechaHora = (iso) => {
  if (!iso) return "—";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "—";
  return fecha.toLocaleString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
};

export const nombreSistema = (origen, destino) => {
  if (origen === "A" || destino === "PAGOS") return "Pagos y Facturación (grupo A)";
  if (origen === "D" || destino === "CONTABILIDAD") return "Contabilidad (grupo D)";
  return origen ? `Grupo ${origen}` : "Sistema externo";
};
