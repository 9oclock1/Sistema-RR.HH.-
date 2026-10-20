// RF-14: reglas del pipeline que la vista necesita antes de llamar al backend (que vuelve a validarlas).

export const CODIGO_ETAPA = {
  CONTRATADO: "CONTRATADO",
  RECHAZADO: "RECHAZADO",
};

const TONOS = {
  POSTULADO: "neutral",
  EN_REVISION: "info",
  ENTREVISTA_TECNICA: "morado",
  APTO: "aviso",
  CONTRATADO: "exito",
  RECHAZADO: "peligro",
};

export const tonoEtapa = (codigo) => TONOS[codigo] ?? "neutral";

// Etapas a las que puede pasar una postulación, con la regla de cada cambio (motivo, cargo).
export function destinosPermitidos(catalogo, idEtapaOrigen) {
  if (!catalogo) return [];
  const etapas = new Map(catalogo.etapas.map((etapa) => [etapa.id_etapa, etapa]));
  return catalogo.transiciones
    .filter((t) => t.id_etapa_origen === idEtapaOrigen && etapas.has(t.id_etapa_destino))
    .map((t) => ({ ...etapas.get(t.id_etapa_destino), solicita_motivo: t.solicita_motivo, requiere_cargo: t.requiere_cargo }));
}

export const puedeMoverse = (catalogo, postulacion) =>
  !postulacion.esta_archivada && destinosPermitidos(catalogo, postulacion.id_etapa).length > 0;

export const nombreCompleto = (postulacion) => `${postulacion.nombres} ${postulacion.apellidos}`.trim();

export function formatearFecha(valor, { conHora = false } = {}) {
  if (!valor) return "—";
  return new Intl.DateTimeFormat("es-BO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(conHora && { hour: "2-digit", minute: "2-digit" }),
  }).format(new Date(valor));
}

export function formatearAfinidad(valor) {
  if (valor === null || valor === undefined) return null;
  const numero = Number(valor);
  return Number.isFinite(numero) ? `${Number.isInteger(numero) ? numero : numero.toFixed(1)}%` : null;
}
