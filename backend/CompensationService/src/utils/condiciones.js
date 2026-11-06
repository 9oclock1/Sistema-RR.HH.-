const { ErrorApp } = require("./errores");
const { UUID_RE } = require("./formatos");
const { esFecha, sumarDias } = require("./fechas");
const { validarConcepto, validarEdicion } = require("./conceptos");

const TIPOS_CONDICION = ["TRASNOCHE", "FERIADO", "ASIGNACION"];
const DETECTABLES = ["TRASNOCHE", "FERIADO"];
const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
// Haber diario = haber básico mensual / 30 (mes comercial).
const DIAS_MES_COMERCIAL = 30;

const redondear = (valor, decimales) => Math.round((valor + Number.EPSILON) * 10 ** decimales) / 10 ** decimales;

// Las condiciones son ingresos; un porcentaje se calcula siempre sobre el haber básico.
const comoConcepto = (datos) => ({
  ...datos,
  tipo: "INGRESO",
  es_de_ley: false,
  base_calculo: datos.forma_calculo === "PORCENTAJE" ? "HABER_BASICO" : null,
});

function validarMinutos(datos, tipo, errores) {
  if (tipo !== "TRASNOCHE") return null;
  const minutos = datos.minutos_nocturnos_minimos;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 600) {
    errores.push({ campo: "minutos_nocturnos_minimos", mensaje: "Ingrese de 1 a 600 minutos." });
  }
  return minutos;
}

// Junta los errores del concepto con los de la condición para mostrarlos todos a la vez.
function conErroresDeConcepto(validar, errores) {
  try {
    return validar();
  } catch (error) {
    if (!(error instanceof ErrorApp)) throw error;
    errores.unshift(...(error.detalles ?? []));
    return null;
  }
}

function validarCondicion(datos = {}) {
  const errores = [];
  const tipo = datos.tipo_condicion;
  const resultado = conErroresDeConcepto(() => validarConcepto(comoConcepto(datos)), errores);
  if (!TIPOS_CONDICION.includes(tipo)) {
    errores.push({ campo: "tipo_condicion", mensaje: "Seleccione trasnoche, feriado o asignación por colaborador." });
  }
  const minutos = validarMinutos(datos, tipo, errores);
  if (errores.length > 0) throw new ErrorApp(400, "Datos de la condición inválidos", errores);
  return { ...resultado, condicion: { tipo_condicion: tipo, minutos_nocturnos_minimos: minutos } };
}

function validarEdicionCondicion(datos = {}, actual) {
  const errores = [];
  for (const campo of ["tipo_condicion", "forma_calculo"]) {
    if (datos[campo] !== undefined && datos[campo] !== actual[campo]) {
      errores.push({ campo, mensaje: "No se puede cambiar después de crear la condición." });
    }
  }
  const forma = actual.forma_calculo;
  const concepto = conErroresDeConcepto(
    () => validarEdicion(comoConcepto({ ...datos, forma_calculo: forma }), forma),
    errores
  );
  const minutos = validarMinutos(datos, actual.tipo_condicion, errores);
  if (errores.length > 0) throw new ErrorApp(400, "Datos de la condición inválidos", errores);
  return { concepto, minutos_nocturnos_minimos: minutos };
}

// Mes a procesar (AAAA-MM): no puede ser posterior al mes en curso.
function rangoPeriodo(periodo, hoy) {
  if (typeof periodo !== "string" || !PERIODO_RE.test(periodo)) {
    throw new ErrorApp(400, "Periodo inválido", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  }
  if (periodo > hoy.slice(0, 7)) {
    throw new ErrorApp(400, "Periodo inválido", [{ campo: "periodo", mensaje: "No se puede procesar un mes futuro." }]);
  }
  const [anio, mes] = periodo.split("-").map(Number);
  const dias = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return { desde: `${periodo}-01`, hasta: `${periodo}-${String(dias).padStart(2, "0")}`, dias };
}

const vigenciaEn = (vigencias, fecha) =>
  vigencias.find((v) => v.vigente_desde <= fecha && (v.vigente_hasta === null || v.vigente_hasta >= fecha)) ?? null;

// Trasnoche: la jornada tiene al menos los minutos nocturnos (20:00 a 06:00) de la condición.
// Feriado: se trabajó en un feriado nacional, aunque caiga en domingo.
function cumpleCondicion(condicion, jornada) {
  if (condicion.tipo_condicion === "TRASNOCHE") {
    return jornada.minutos_nocturnos >= condicion.minutos_nocturnos_minimos;
  }
  if (condicion.tipo_condicion === "FERIADO") return Boolean(jornada.feriado) && jornada.minutos_trabajados > 0;
  return false;
}

function armarBono({ condicion, vigencia, factor, ...bono }) {
  return {
    id_condicion: condicion.id_condicion,
    id_vigencia: vigencia.id_vigencia,
    id_asignacion: null,
    fechas: [],
    ...bono,
    factor: redondear(factor, 6),
    valor: vigencia.valor,
    // El porcentaje lo calcula la planilla sobre el haber básico.
    monto: condicion.forma_calculo === "MONTO_FIJO" ? redondear(vigencia.valor * factor, 2) : null,
  };
}

function agrupar(grupos, clave, inicial) {
  if (!grupos.has(clave)) grupos.set(clave, { ...inicial, fechas: [] });
  return grupos.get(clave);
}

// Un bono por condición, colaborador y vigencia: monto fijo por jornada, o porcentaje del haber diario por jornada.
function bonosDetectados(condiciones, jornadas) {
  const grupos = new Map();
  for (const condicion of condiciones.filter((c) => DETECTABLES.includes(c.tipo_condicion))) {
    for (const jornada of jornadas) {
      if (!cumpleCondicion(condicion, jornada)) continue;
      const vigencia = vigenciaEn(condicion.vigencias, jornada.fecha_jornada);
      if (!vigencia) continue;
      const clave = `${condicion.id_condicion}|${jornada.id_empleado}|${vigencia.id_vigencia}`;
      agrupar(grupos, clave, { condicion, vigencia, id_empleado: jornada.id_empleado }).fechas.push(
        jornada.fecha_jornada
      );
    }
  }
  return [...grupos.values()].map(({ fechas, ...g }) =>
    armarBono({
      ...g,
      origen: "DETECCION",
      cantidad: fechas.length,
      fechas: fechas.sort(),
      factor: g.condicion.forma_calculo === "MONTO_FIJO" ? fechas.length : fechas.length / DIAS_MES_COMERCIAL,
    })
  );
}

// Asignaciones vigentes en el mes: el valor mensual se prorratea por los días asignados.
function bonosAsignados(condiciones, asignaciones, { desde, hasta, dias }) {
  const porId = new Map(condiciones.filter((c) => c.tipo_condicion === "ASIGNACION").map((c) => [c.id_condicion, c]));
  const grupos = new Map();
  for (const asignacion of asignaciones) {
    const condicion = porId.get(asignacion.id_condicion);
    if (!condicion) continue;
    const inicio = asignacion.vigente_desde > desde ? asignacion.vigente_desde : desde;
    const fin = asignacion.vigente_hasta && asignacion.vigente_hasta < hasta ? asignacion.vigente_hasta : hasta;
    for (let fecha = inicio; fecha <= fin; fecha = sumarDias(fecha, 1)) {
      const vigencia = vigenciaEn(condicion.vigencias, fecha);
      if (!vigencia) continue;
      const clave = `${asignacion.id_asignacion}|${vigencia.id_vigencia}`;
      agrupar(grupos, clave, { condicion, vigencia, asignacion }).fechas.push(fecha);
    }
  }
  return [...grupos.values()].map(({ asignacion, fechas, ...g }) =>
    armarBono({
      ...g,
      id_empleado: asignacion.id_empleado,
      nombre_empleado: asignacion.nombre_empleado,
      id_asignacion: asignacion.id_asignacion,
      origen: "ASIGNACION",
      cantidad: fechas.length,
      factor: fechas.length / dias,
    })
  );
}

const MAXIMO_POR_ASIGNACION = 200;

function validarFin(vigente_desde, vigente_hasta, errores) {
  if (vigente_hasta === undefined || vigente_hasta === null || vigente_hasta === "") return null;
  if (!esFecha(vigente_hasta)) errores.push({ campo: "vigente_hasta", mensaje: "Ingrese una fecha válida." });
  else if (esFecha(vigente_desde) && vigente_hasta < vigente_desde) {
    errores.push({ campo: "vigente_hasta", mensaje: "Debe ser igual o posterior a la fecha de inicio." });
  }
  return vigente_hasta;
}

// Una o varias personas con la misma condición y fechas (por ejemplo, todo el personal de congelados).
function validarAsignacion(datos = {}) {
  const errores = [];
  const { ids_empleado, vigente_desde } = datos;
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";
  const ids = Array.isArray(ids_empleado) ? [...new Set(ids_empleado.map((id) => String(id).toLowerCase()))] : [];
  if (ids.length === 0) errores.push({ campo: "ids_empleado", mensaje: "Seleccione al menos un colaborador." });
  else if (ids.length > MAXIMO_POR_ASIGNACION) {
    errores.push({ campo: "ids_empleado", mensaje: `Asigne hasta ${MAXIMO_POR_ASIGNACION} colaboradores a la vez.` });
  } else if (!ids.every((id) => UUID_RE.test(id))) {
    errores.push({ campo: "ids_empleado", mensaje: "Hay colaboradores inválidos." });
  }
  if (!esFecha(vigente_desde)) errores.push({ campo: "vigente_desde", mensaje: "Ingrese una fecha válida." });
  const vigente_hasta = validarFin(vigente_desde, datos.vigente_hasta, errores);
  if (motivo.length > 250) errores.push({ campo: "motivo", mensaje: "Use hasta 250 caracteres." });
  if (errores.length > 0) throw new ErrorApp(400, "Datos de la asignación inválidos", errores);
  return { ids, vigente_desde, vigente_hasta, motivo: motivo || null };
}

// Cambiar o quitar la fecha de fin de una asignación (por ejemplo, al dejar el área de congelados).
function validarCambioFin(datos = {}, vigente_desde) {
  const errores = [];
  if (!("vigente_hasta" in datos)) {
    errores.push({ campo: "vigente_hasta", mensaje: "Indique la fecha de fin o null para dejarla abierta." });
  }
  const vigente_hasta = validarFin(vigente_desde, datos.vigente_hasta, errores);
  if (errores.length > 0) throw new ErrorApp(400, "Datos de la asignación inválidos", errores);
  return vigente_hasta;
}

module.exports = {
  TIPOS_CONDICION,
  DETECTABLES,
  validarCondicion,
  validarEdicionCondicion,
  validarAsignacion,
  validarCambioFin,
  rangoPeriodo,
  vigenciaEn,
  cumpleCondicion,
  bonosDetectados,
  bonosAsignados,
};
