export const RUTA_CASOS_QUEJA = "/desempeno/casos-quejas";
export const rutaCasoQueja = (idQueja) => `${RUTA_CASOS_QUEJA}/${idQueja}`;
export const RUTA_MIS_CASOS_QUEJA = "/desempeno/mis-casos-quejas";
export const rutaMiCasoQueja = (idQueja) => `${RUTA_MIS_CASOS_QUEJA}/${idQueja}`;

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

export const ACCION = { MIN: 10, MAX: 2000 };
export const RESOLUCION = { MIN: 10, MAX: 2000 };
export const ESTADO_RESUELTA = "RESUELTA";

function validarTexto(valor, { MIN, MAX }, { vacio, nombre }) {
  const limpio = valor.trim();
  if (!limpio) return vacio;
  if (limpio.length < MIN) return `${nombre} debe tener al menos ${MIN} caracteres.`;
  if (limpio.length > MAX) return `${nombre} puede tener hasta ${MAX} caracteres.`;
  return null;
}

export function validarAccion({ idTipo, descripcion }) {
  const errores = {};
  if (!idTipo) errores.id_tipo_accion_queja = "Indique si la acción es preventiva o correctiva.";
  const descripcionInvalida = validarTexto(descripcion, ACCION, {
    vacio: "Describa la acción realizada.",
    nombre: "La descripción",
  });
  if (descripcionInvalida) errores.descripcion = descripcionInvalida;
  return errores;
}

export function validarCambioEstado({ estado, resolucion }) {
  if (!estado) return { id_estado_queja: "Seleccione el nuevo estado del caso." };
  if (estado.codigo !== ESTADO_RESUELTA) return {};
  const resolucionInvalida = validarTexto(resolucion, RESOLUCION, {
    vacio: "Describa cómo se resolvió el caso: es obligatorio para marcarlo como resuelto.",
    nombre: "La descripción de la resolución",
  });
  return resolucionInvalida ? { resolucion: resolucionInvalida } : {};
}
