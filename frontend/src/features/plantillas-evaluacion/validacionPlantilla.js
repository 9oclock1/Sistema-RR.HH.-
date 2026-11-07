import { formatearFecha } from "../solicitud-vacaciones/formato";

export const LIMITES = {
  nombre: 120,
  objetivo: 1000,
  competenciaNombre: 100,
  competenciaDescripcion: 255,
};

const esFechaReal = (texto) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texto)) return false;
  const fecha = new Date(`${texto}T00:00:00Z`);
  return (
    !Number.isNaN(fecha.getTime()) && fecha.toISOString().slice(0, 10) === texto
  );
};

export function validarDatosPlantilla(valores) {
  const errores = {};
  const nombre = valores.nombre.trim();
  const objetivo = valores.objetivo.trim();

  if (!nombre) errores.nombre = "El nombre es obligatorio.";
  else if (nombre.length > LIMITES.nombre)
    errores.nombre = `El nombre admite hasta ${LIMITES.nombre} caracteres.`;

  if (!valores.id_departamento)
    errores.id_departamento = "Seleccione el área destino.";

  if (!objetivo) errores.objetivo = "El objetivo es obligatorio.";
  else if (objetivo.length > LIMITES.objetivo)
    errores.objetivo = `El objetivo admite hasta ${LIMITES.objetivo} caracteres.`;

  if (!valores.vigencia_desde)
    errores.vigencia_desde = "Indique desde cuándo rige la plantilla.";
  else if (!esFechaReal(valores.vigencia_desde))
    errores.vigencia_desde = "La fecha de inicio no es válida.";

  if (!valores.vigencia_hasta)
    errores.vigencia_hasta = "Indique hasta cuándo rige la plantilla.";
  else if (!esFechaReal(valores.vigencia_hasta))
    errores.vigencia_hasta = "La fecha de fin no es válida.";
  else if (
    !errores.vigencia_desde &&
    valores.vigencia_hasta < valores.vigencia_desde
  )
    errores.vigencia_hasta =
      "La fecha de fin no puede ser anterior a la de inicio.";

  return errores;
}

export function validarDatosCompetencia(valores) {
  const errores = {};
  const nombre = valores.nombre.trim();

  if (!nombre) errores.nombre = "El nombre es obligatorio.";
  else if (nombre.length > LIMITES.competenciaNombre)
    errores.nombre = `El nombre admite hasta ${LIMITES.competenciaNombre} caracteres.`;

  if (!valores.tipo)
    errores.tipo =
      "Seleccione si es una competencia laboral o un factor operativo.";

  if (valores.descripcion.trim().length > LIMITES.competenciaDescripcion)
    errores.descripcion = `La descripción admite hasta ${LIMITES.competenciaDescripcion} caracteres.`;

  return errores;
}

// Lo que todavía impide publicar una versión; vacío si ya se puede. Es el mismo criterio del servicio:
// cabecera completa, vigencia vigente o futura, al menos una sección y todas con competencias activas.
export function pendientesPublicacion({ plantilla, secciones, hoy }) {
  const pendientes = [];
  if (plantilla.vigencia_hasta < hoy)
    pendientes.push(
      `La vigencia terminó el ${formatearFecha(plantilla.vigencia_hasta)}: actualice las fechas de la plantilla.`,
    );
  if (secciones.length === 0)
    pendientes.push(
      "Agregue al menos una sección de competencia o factor operativo.",
    );
  secciones
    .filter((competencia) => !competencia.esta_activa)
    .forEach((competencia) =>
      pendientes.push(
        `La competencia «${competencia.nombre}» está desactivada: quítela o reemplácela.`,
      ),
    );
  return pendientes;
}
