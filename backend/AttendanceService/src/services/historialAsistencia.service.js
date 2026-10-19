const modelo = require("../models/historialAsistencia.model");
const novedadesModelo = require("../models/novedades.model");
const { ErrorApp } = require("../utils/errores");
const { UUID_RE } = require("../utils/formatos");
const { esFechaValida, sumarDias } = require("../utils/periodos");

const DIAS_POR_DEFECTO = 365;
const DIAS_MAXIMOS = 366;

function leerRango({ desde, hasta } = {}, hoy) {
  const fin = hasta || hoy;
  const inicio = desde || sumarDias(fin, -(DIAS_POR_DEFECTO - 1));
  const errores = [];
  if (!esFechaValida(inicio)) errores.push({ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." });
  if (!esFechaValida(fin)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  if (errores.length === 0 && inicio > fin) {
    errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la final." });
  } else if (errores.length === 0 && sumarDias(inicio, DIAS_MAXIMOS) < fin) {
    errores.push({ campo: "desde", mensaje: `Consulte como máximo ${DIAS_MAXIMOS} días.` });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return { desde: inicio, hasta: fin };
}

function resumir(jornadas) {
  const novedades = jornadas.flatMap((jornada) => jornada.novedades);
  const deTipo = (tipo) => novedades.filter((novedad) => novedad.tipo === tipo);
  const sumar = (lista, campo) => lista.reduce((total, elemento) => total + (elemento[campo] ?? 0), 0);

  return {
    jornadas_trabajadas: jornadas.filter((jornada) => jornada.entrada_en).length,
    minutos_trabajados: sumar(jornadas, "minutos_trabajados"),
    minutos_extra: sumar(jornadas, "minutos_extra"),
    atrasos: deTipo("ATRASO").length,
    minutos_atraso: sumar(deTipo("ATRASO"), "minutos"),
    inasistencias: deTipo("INASISTENCIA").length,
    salidas_anticipadas: deTipo("SALIDA_ANTICIPADA").length,
    omisiones_salida: deTipo("OMISION_SALIDA").length,
    novedades_justificadas: novedades.filter((novedad) => novedad.estado === "JUSTIFICADA").length,
  };
}

async function historial(idEmpleado, filtros) {
  if (!UUID_RE.test(idEmpleado ?? "")) {
    throw new ErrorApp(400, "Empleado inválido", [{ campo: "idEmpleado", mensaje: "Debe ser un UUID válido." }]);
  }
  const { hoy } = await novedadesModelo.momentoActual();
  const { desde, hasta } = leerRango(filtros, hoy);
  const jornadas = await modelo.listarJornadas(idEmpleado.toLowerCase(), desde, hasta);
  return { id_empleado: idEmpleado.toLowerCase(), desde, hasta, resumen: resumir(jornadas), jornadas };
}

module.exports = { historial };
