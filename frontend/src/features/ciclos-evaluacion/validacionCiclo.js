import { hoyEnBolivia } from "../evaluaciones/formato";
import { formatearDia } from "./ciclo";

export const NOMBRE_MAX = 120;

export const PASOS = [
  { id: "plantilla", etiqueta: "Plantilla y periodo" },
  { id: "fechas", etiqueta: "Nombre y fechas" },
  { id: "alcance", etiqueta: "Alcance" },
  { id: "revision", etiqueta: "Revisión" },
];

// Los errores usan los mismos nombres de campo que el servicio, así los del servidor y los locales se muestran igual.
const CAMPOS_POR_PASO = {
  plantilla: ["id_version", "id_periodo"],
  fechas: ["nombre", "fecha_inicio", "fecha_limite"],
  alcance: ["alcance"],
};

// Paso del asistente al que pertenece un campo (p. ej. «alcance.areas[0]» es del paso de alcance).
export function pasoDelCampo(campo) {
  const base = String(campo ?? "").split(/[.[]/)[0];
  return Object.entries(CAMPOS_POR_PASO).find(([, campos]) => campos.includes(base))?.[0] ?? null;
}

const esFecha = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor ?? "");

export function validarPlantillaYPeriodo({ idVersion, idPeriodo }) {
  const errores = {};
  if (!idVersion) errores.id_version = "Seleccione la plantilla publicada que se usará.";
  if (!idPeriodo) errores.id_periodo = "Seleccione el periodo de evaluación.";
  return errores;
}

export function validarNombreYFechas({ nombre, fechaInicio, fechaLimite }, { periodo, hoy = hoyEnBolivia() } = {}) {
  const errores = {};
  const limpio = nombre.trim();
  if (!limpio || limpio.length > NOMBRE_MAX) errores.nombre = `Ingrese un nombre de hasta ${NOMBRE_MAX} caracteres.`;

  if (!esFecha(fechaInicio)) errores.fecha_inicio = "Ingrese la fecha de inicio.";
  else if (fechaInicio < hoy) errores.fecha_inicio = "La fecha de inicio no puede ser anterior a hoy.";
  else if (periodo && fechaInicio < periodo.fecha_inicio) {
    errores.fecha_inicio = `La fecha de inicio no puede ser anterior al inicio del periodo «${periodo.nombre}» (${formatearDia(periodo.fecha_inicio)}).`;
  }

  if (!esFecha(fechaLimite)) errores.fecha_limite = "Ingrese la fecha límite.";
  else if (esFecha(fechaInicio) && fechaLimite < fechaInicio) {
    errores.fecha_limite = "Debe ser igual o posterior a la fecha de inicio.";
  } else if (fechaLimite < hoy) errores.fecha_limite = "La fecha límite no puede ser anterior a hoy.";

  return errores;
}

export function validarAlcanceCiclo({ areas, sucursales, colaboradores }) {
  if (areas.length + sucursales.length + colaboradores.length === 0) {
    return { alcance: "Seleccione al menos un área, una sucursal o un colaborador." };
  }
  return {};
}
