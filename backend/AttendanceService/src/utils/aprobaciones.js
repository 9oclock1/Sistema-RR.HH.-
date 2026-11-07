const { sumarDias } = require("./periodos");

// KAN-53: las dos clases de ausencia que un supervisor o RRHH resuelve desde la misma bandeja.
const CATEGORIA = { VACACIONES: "VACACIONES", LICENCIA: "LICENCIA" };
const ESTADOS_BANDEJA = ["PENDIENTE", "APROBADA", "RECHAZADA", "TODAS"];
const PRIORIDADES = ["ALTA", "MEDIA", "BAJA"];

// Una solicitud que empieza pronto (o ya empezó) no admite espera; la de más de un mes sí.
const DIAS_PRIORIDAD_ALTA = 7;
const DIAS_PRIORIDAD_MEDIA = 30;

// Equipo con tantas ausencias a la vez deja de cubrir el servicio con normalidad.
const UMBRAL_IMPACTO_MEDIO = 0.25;
const UMBRAL_IMPACTO_ALTO = 0.5;
const DIAS_MAXIMOS_COBERTURA = 92;

const DIA_MS = 24 * 60 * 60 * 1000;
const diasEntre = (desde, hasta) => Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);

// Las licencias que superan su tope exigen autorización de RRHH, así que se atienden primero.
function calcularPrioridad({ fechaInicio, hoy, exigeRrhh = false }) {
  if (exigeRrhh) return "ALTA";
  const faltan = diasEntre(hoy, fechaInicio);
  if (faltan <= DIAS_PRIORIDAD_ALTA) return "ALTA";
  if (faltan <= DIAS_PRIORIDAD_MEDIA) return "MEDIA";
  return "BAJA";
}

const ORDEN_PRIORIDAD = Object.fromEntries(PRIORIDADES.map((prioridad, indice) => [prioridad, indice]));

// Pendientes primero por prioridad y cercanía de la fecha; las resueltas, de la más reciente a la más antigua.
function ordenarBandeja(items) {
  return [...items].sort((a, b) => {
    const pendienteA = a.estado.codigo === "PENDIENTE";
    const pendienteB = b.estado.codigo === "PENDIENTE";
    if (pendienteA !== pendienteB) return pendienteA ? -1 : 1;
    if (pendienteA) {
      return (
        ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad] ||
        a.fecha_inicio.localeCompare(b.fecha_inicio) ||
        a.creado_en - b.creado_en
      );
    }
    return new Date(b.resuelto_en ?? 0) - new Date(a.resuelto_en ?? 0);
  });
}

// Impacto en el equipo (criterio 1): cuántos compañeros estarían ausentes a la vez durante la solicitud.
// `ausencias` son las de los compañeros que se cruzan con el rango; solo las aprobadas restan cobertura segura,
// las pendientes se informan como posibles. `equipoTotal` cuenta a todos los activos, incluido el solicitante.
function calcularCobertura({ fechaInicio, fechaFin, equipoTotal, ausencias }) {
  const aprobadas = ausencias.filter((a) => a.estado_codigo === "APROBADA");
  const pendientes = ausencias.filter((a) => a.estado_codigo === "PENDIENTE");
  const limite = Math.min(diasEntre(fechaInicio, fechaFin), DIAS_MAXIMOS_COBERTURA - 1);

  let maximo = 1;
  let maximoConPendientes = 1;
  for (let dia = 0; dia <= limite; dia++) {
    const fecha = sumarDias(fechaInicio, dia);
    const enFecha = (lista) => lista.filter((a) => a.fecha_inicio <= fecha && a.fecha_fin >= fecha).length;
    maximo = Math.max(maximo, 1 + enFecha(aprobadas));
    maximoConPendientes = Math.max(maximoConPendientes, 1 + enFecha(aprobadas) + enFecha(pendientes));
  }

  const proporcion = equipoTotal > 0 ? maximo / equipoTotal : null;
  let nivel = "BAJO";
  if (proporcion === null) nivel = "SIN_DATOS";
  else if (proporcion >= UMBRAL_IMPACTO_ALTO) nivel = "ALTO";
  else if (proporcion >= UMBRAL_IMPACTO_MEDIO) nivel = "MEDIO";

  return {
    equipo_total: equipoTotal,
    maximo_ausentes_simultaneos: maximo,
    maximo_con_pendientes: maximoConPendientes,
    porcentaje_equipo: proporcion === null ? null : Math.round(proporcion * 100),
    nivel_impacto: nivel,
    ausencias,
  };
}

// Una licencia sobre su tope solo la autoriza RRHH (KAN-51, criterio 4); el supervisor puede rechazarla.
const ROLES_RRHH = ["gerente", "admin"];
const requiereAutorizacionRrhh = ({ excede_limite_dias }, decision, rol) =>
  decision === "APROBADA" && excede_limite_dias === true && !ROLES_RRHH.includes(rol);

module.exports = {
  CATEGORIA,
  ESTADOS_BANDEJA,
  PRIORIDADES,
  calcularPrioridad,
  ordenarBandeja,
  calcularCobertura,
  requiereAutorizacionRrhh,
};
