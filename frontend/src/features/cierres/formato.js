export const FILTROS_ESTADO_CIERRE = {
  PENDIENTE_CIERRE: { etiqueta: "Pendiente de cierre", tono: "aviso" },
  EN_PROCESO: { etiqueta: "Revocando accesos", tono: "info" },
  COMPLETADO: { etiqueta: "Completado", tono: "exito" },
  CON_ALERTAS: { etiqueta: "Con alertas", tono: "peligro" },
};

export const ESTADOS_FINIQUITO = {
  APROBADO: { etiqueta: "Aprobado", tono: "info" },
  PAGADO: { etiqueta: "Pagado", tono: "exito" },
};

export const ESTADOS_REVOCACION = {
  PENDIENTE: { etiqueta: "Pendiente", tono: "aviso" },
  ENVIADA: { etiqueta: "Enviada", tono: "info" },
  CONFIRMADA: { etiqueta: "Confirmada", tono: "exito" },
  RECHAZADA: { etiqueta: "Rechazada", tono: "peligro" },
  VENCIDA: { etiqueta: "Vencida", tono: "peligro" },
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

export const SISTEMAS_POR_DESTINO = {
  VENTAS: "Ventas/POS (grupo E)",
  INVENTARIOS: "Inventarios (grupo I)",
  ENTREGAS: "Entregas (grupo H)",
  CRM: "CRM (grupo B)",
};

export const SISTEMAS_POR_GRUPO = {
  E: "Ventas/POS (grupo E)",
  I: "Inventarios (grupo I)",
  H: "Entregas (grupo H)",
  B: "CRM (grupo B)",
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
  if (destino && SISTEMAS_POR_DESTINO[destino]) return SISTEMAS_POR_DESTINO[destino];
  if (origen && SISTEMAS_POR_GRUPO[origen]) return SISTEMAS_POR_GRUPO[origen];
  return origen ? `Grupo ${origen}` : "Sistema externo";
};

export const estadoCierreLista = (fila) => {
  if (!fila?.cierre) return FILTROS_ESTADO_CIERRE.PENDIENTE_CIERRE;
  return FILTROS_ESTADO_CIERRE[fila.cierre.estado_revocaciones] ?? FILTROS_ESTADO_CIERRE.EN_PROCESO;
};
