const { agruparPorCentroDeCosto, ESTADO_CONCILIACION } = require("./integraciones");
const { agruparAguinaldoPorCentroDeCosto } = require("./aguinaldo");

// Reporte contable consolidado de planillas por periodo y centro de costo (RF-49, KAN-69). Un reporte
// siempre consolida UN recurso cerrado (una planilla mensual o la planilla de aguinaldos de una gestión):
// los totales por construcción cuadran con lo que esa planilla envió a Contabilidad (criterio 3), y el
// estado de conciliación es el mismo estado_contabilidad/estado_pagos de siempre (criterio 2).
const NOMBRE_DESTINO = { contabilidad: "Contabilidad", pagos: "Pagos" };

function conciliacionDe(recurso) {
  const integracion = (campo) => ({
    estado: ESTADO_CONCILIACION[recurso[`estado_${campo}`]],
    referencia: recurso[`referencia_${campo}`] ?? null,
    motivo: recurso[`motivo_${campo}`] ?? null,
    respondida_en: recurso[`respondida_${campo}_en`] ?? null,
  });
  return { contabilidad: integracion("contabilidad"), pagos: integracion("pagos") };
}

const sumarTotales = (centros, campo) => Math.round(centros.reduce((t, c) => t + c[campo], 0) * 100) / 100;

function totalesDe(centros) {
  const total_debe = sumarTotales(centros, "total_debe");
  const total_haber = sumarTotales(centros, "total_haber");
  return { total_debe, total_haber, cuadra: total_debe === total_haber };
}

function construirReportePlanilla({ planilla, filasConceptos, filasPasivos }) {
  const centros_costo = agruparPorCentroDeCosto({ filasConceptos, filasPasivos });
  return {
    recurso: "PLANILLA",
    id_recurso: planilla.id_planilla,
    periodo: planilla.periodo,
    estado: planilla.estado,
    colaboradores: planilla.colaboradores,
    centros_costo,
    totales: totalesDe(centros_costo),
    conciliacion: conciliacionDe(planilla),
  };
}

function construirReporteAguinaldo({ aguinaldo, filasPorCentro }) {
  const centros_costo = agruparAguinaldoPorCentroDeCosto(filasPorCentro);
  return {
    recurso: "AGUINALDO",
    id_recurso: aguinaldo.id_aguinaldo,
    gestion: aguinaldo.gestion,
    estado: aguinaldo.estado,
    colaboradores: aguinaldo.colaboradores,
    centros_costo,
    totales: totalesDe(centros_costo),
    conciliacion: conciliacionDe(aguinaldo),
  };
}

module.exports = { NOMBRE_DESTINO, conciliacionDe, totalesDe, construirReportePlanilla, construirReporteAguinaldo };
