export const RUTA_CASOS_QUEJA = "/desempeno/casos-quejas";
export const rutaCasoQueja = (idQueja) => `${RUTA_CASOS_QUEJA}/${idQueja}`;

export const TAMANO_PAGINA = 20;
export const SIN_PRIORIDAD = "sin";
export const COMENTARIO_MAX = 500;
export const CONFLICTO_INTERES = "CONFLICTO_INTERES";

const TONOS_PRIORIDAD = { BAJA: "neutral", MEDIA: "info", ALTA: "aviso", CRITICA: "peligro" };
export const tonoPrioridad = (codigo) => TONOS_PRIORIDAD[codigo] ?? "neutral";

export const AVISOS = {
  ENTREGADO: { tono: "exito", texto: "Aviso entregado" },
  FALLIDO: { tono: "peligro", texto: "Aviso no entregado" },
  PENDIENTE: { tono: "aviso", texto: "Aviso pendiente" },
};

export const MOTIVOS_RESPONSABLE = { RRHH: "RRHH", SUPERVISOR: "Supervisor" };

export const nombreDe = (persona) => persona?.nombre_completo || "Nombre no disponible";

export const esConflictoInteres = (error) =>
  error?.estado === 409 && (error.detalles ?? []).some((detalle) => detalle.codigo === CONFLICTO_INTERES);

export const idsEnConflicto = (caso) =>
  new Set([...caso.involucrados.map((persona) => persona.id_empleado), caso.denunciante?.id_empleado].filter(Boolean));

const fechaCorta = new Intl.DateTimeFormat("es-BO", {
  timeZone: "America/La_Paz",
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export const formatearFechaCorta = (valor) => fechaCorta.format(new Date(valor));

export function validarDerivacion({ idCategoria, idPrioridad, idResponsable, comentario }, { conResponsable }) {
  const errores = {};
  if (!idCategoria) errores.id_categoria_queja = "Seleccione la categoría.";
  if (!idPrioridad) errores.id_prioridad_queja = "Seleccione la prioridad.";
  if (conResponsable && !idResponsable) errores.id_empleado_responsable = "Seleccione el responsable del caso.";
  if (comentario.trim().length > COMENTARIO_MAX) {
    errores.comentario = `El comentario puede tener hasta ${COMENTARIO_MAX} caracteres.`;
  }
  return errores;
}
