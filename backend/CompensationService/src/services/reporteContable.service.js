const pool = require("../config/db");
const planillasModelo = require("../models/planillas.model");
const aguinaldoModelo = require("../models/aguinaldo.model");
const { ErrorApp } = require("../utils/errores");
const { validarGestion } = require("../utils/aguinaldo");
const { construirReportePlanilla, construirReporteAguinaldo } = require("../utils/reporteContable");

const PERIODO_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

const noCerrado = (nombre) =>
  new ErrorApp(409, `${nombre} todavía está en borrador: genere el reporte contable cuando el periodo esté cerrado.`);

// Criterio 1: el reporte contable consolidado de UNA planilla mensual, por cuenta contable y centro de
// costo. Solo tiene sentido con el periodo ya consolidado (no en borrador): antes de eso los montos pueden
// cambiar y no hay nada que conciliar todavía.
async function generarPlanilla(periodo) {
  if (!PERIODO_RE.test(periodo ?? "")) {
    throw new ErrorApp(400, "Filtros inválidos", [{ campo: "periodo", mensaje: "Use el formato AAAA-MM." }]);
  }
  const planilla = (await planillasModelo.listar(periodo))[0];
  if (!planilla) throw new ErrorApp(404, `No existe una planilla para el periodo ${periodo}.`);
  if (planilla.estado === "BORRADOR") throw noCerrado(`La planilla de ${periodo}`);
  const [filasConceptos, filasPasivos] = await Promise.all([
    planillasModelo.conceptosPorCentroDeCosto(pool, planilla.id_planilla),
    planillasModelo.pasivosPorCentroDeCosto(pool, planilla.id_planilla),
  ]);
  return construirReportePlanilla({ planilla, filasConceptos, filasPasivos });
}

async function generarAguinaldo(gestion) {
  const gestionValidada = validarGestion(gestion);
  const aguinaldo = (await aguinaldoModelo.listar()).find((a) => a.gestion === gestionValidada);
  if (!aguinaldo) throw new ErrorApp(404, `No existe una planilla de aguinaldos para la gestión ${gestionValidada}.`);
  if (aguinaldo.estado === "BORRADOR") throw noCerrado(`La planilla de aguinaldos de la gestión ${gestionValidada}`);
  const filasPorCentro = await aguinaldoModelo.montosPorCentroDeCosto(pool, aguinaldo.id_aguinaldo);
  return construirReporteAguinaldo({ aguinaldo, filasPorCentro });
}

module.exports = { generarPlanilla, generarAguinaldo };
