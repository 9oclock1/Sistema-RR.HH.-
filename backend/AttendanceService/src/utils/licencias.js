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

module.exports = { ESTADO_SOLICITUD, diasSolicitados, evaluarLimite, clasificarParaNomina };
