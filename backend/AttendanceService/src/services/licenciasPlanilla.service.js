const modelo = require("../models/licenciasPlanilla.model");
const { ErrorApp } = require("../utils/errores");
const { esFechaValida, sumarDias } = require("../utils/periodos");

const DIAS_MAXIMOS = 92;

function leerRango({ desde, hasta } = {}) {
  const errores = [];
  if (!esFechaValida(desde)) errores.push({ campo: "desde", mensaje: "Use el formato AAAA-MM-DD." });
  if (!esFechaValida(hasta)) errores.push({ campo: "hasta", mensaje: "Use el formato AAAA-MM-DD." });
  if (errores.length === 0 && desde > hasta) {
    errores.push({ campo: "desde", mensaje: "La fecha inicial no puede ser posterior a la final." });
  } else if (errores.length === 0 && sumarDias(desde, DIAS_MAXIMOS - 1) < hasta) {
    errores.push({ campo: "hasta", mensaje: `Consulte como máximo ${DIAS_MAXIMOS} días.` });
  }
  if (errores.length > 0) throw new ErrorApp(400, "Filtros inválidos", errores);
  return { desde, hasta };
}

// Licencias aprobadas de todo el personal en el rango, para la planilla mensual (con o sin goce de haberes).
async function listarAprobadas(filtros) {
  const { desde, hasta } = leerRango(filtros);
  const filas = await modelo.listarAprobadas(desde, hasta);
  return {
    desde,
    hasta,
    licencias: filas.map((l) => ({
      id_solicitud: l.id_solicitud,
      id_empleado: l.id_empleado,
      tipo: { codigo: l.tipo_codigo, nombre: l.tipo_nombre },
      fecha_inicio: l.fecha_inicio,
      fecha_fin: l.fecha_fin,
      con_goce_haberes: l.es_con_goce_haberes,
    })),
  };
}

module.exports = { listarAprobadas };
