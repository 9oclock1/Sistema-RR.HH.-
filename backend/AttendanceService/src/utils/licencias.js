const ESTADO_SOLICITUD = { PENDIENTE: 1, APROBADA: 2, RECHAZADA: 3, CANCELADA: 4 };

const MS_POR_DIA = 24 * 60 * 60 * 1000;

// Días corridos entre dos fechas AAAA-MM-DD, ambas incluidas (igual que dias_solicitados en la BD).
function diasSolicitados(fechaInicio, fechaFin) {
  return Math.round((Date.parse(`${fechaFin}T00:00:00Z`) - Date.parse(`${fechaInicio}T00:00:00Z`)) / MS_POR_DIA) + 1;
}

// Criterio 4: sin tope (null) nunca excede; con tope, excede si lo supera.
function evaluarLimite(tipo, dias) {
  const tope = tipo.dias_maximos_continuos ?? null;
  return { tope, excede: tope !== null && dias > tope };
}

// Criterio 2: el goce de haberes lo define el catálogo, no el empleado.
const clasificarParaNomina = (tipo) => (tipo.es_con_goce_haberes ? "CON_GOCE" : "SIN_GOCE");

const MAX_MOTIVO_RESOLUCION = 500;
const DECISIONES = { APROBADA: ESTADO_SOLICITUD.APROBADA, RECHAZADA: ESTADO_SOLICITUD.RECHAZADA };

// KAN-54 criterio 2: un rechazo no se registra sin la justificación que leerá el colaborador.
function validarResolucion(datos = {}) {
  const decision = typeof datos.decision === "string" ? datos.decision.trim().toUpperCase() : "";
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";
  const errores = [];
  if (!Object.hasOwn(DECISIONES, decision)) {
    errores.push({ campo: "decision", mensaje: "La decisión debe ser APROBADA o RECHAZADA." });
  }
  if (decision === "RECHAZADA" && !motivo) {
    errores.push({ campo: "motivo", mensaje: "Ingrese la justificación del rechazo." });
  }
  if (motivo.length > MAX_MOTIVO_RESOLUCION) {
    errores.push({ campo: "motivo", mensaje: `El motivo no puede exceder los ${MAX_MOTIVO_RESOLUCION} caracteres.` });
  }
  return { errores, decision, motivo: motivo || null };
}

module.exports = { ESTADO_SOLICITUD, DECISIONES, diasSolicitados, evaluarLimite, clasificarParaNomina, validarResolucion };
