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

// Funde varias listas de centros de costo (misma forma que agruparPorCentroDeCosto/agruparAguinaldoPorCentroDeCosto:
// {centro_costo, sucursal, area, renglones:[{cuenta,debe,haber}], total_debe, total_haber}) en una sola, sumando
// por cuenta contable dentro de cada (sucursal, área). La usa el reporte de la planilla mensual para incluir el
// aguinaldo que cerró ese mismo mes (ver reporteContable.service#generarPlanilla): así "Sueldos y salarios por
// pagar", por ejemplo, queda con el pasivo de sueldos MÁS el de aguinaldo del centro, en vez de dos reportes
// que nunca se cruzan.
function combinarCentros(listas) {
  const centros = new Map();
  for (const lista of listas) {
    for (const c of lista) {
      const clave = `${c.sucursal}|${c.area}`;
      if (!centros.has(clave)) {
        centros.set(clave, { centro_costo: c.centro_costo, sucursal: c.sucursal, area: c.area, cuentas: new Map() });
      }
      const centro = centros.get(clave);
      for (const r of c.renglones) {
        const actual = centro.cuentas.get(r.cuenta.codigo) ?? { cuenta: r.cuenta, debe: 0, haber: 0 };
        actual.debe = Math.round((actual.debe + r.debe) * 100) / 100;
        actual.haber = Math.round((actual.haber + r.haber) * 100) / 100;
        centro.cuentas.set(r.cuenta.codigo, actual);
      }
    }
  }
  return [...centros.values()]
    .map((c) => {
      const renglones = [...c.cuentas.values()].sort((a, b) => a.cuenta.codigo.localeCompare(b.cuenta.codigo));
      return {
        centro_costo: c.centro_costo,
        sucursal: c.sucursal,
        area: c.area,
        renglones,
        total_debe: Math.round(renglones.reduce((t, r) => t + r.debe, 0) * 100) / 100,
        total_haber: Math.round(renglones.reduce((t, r) => t + r.haber, 0) * 100) / 100,
      };
    })
    .sort((a, b) => a.centro_costo.localeCompare(b.centro_costo, "es"));
}

// Criterio 1: "sueldos, cargas sociales, horas extras, aguinaldos" en UN reporte por periodo. El aguinaldo de
// una gestión no tiene un periodo mensual propio, pero sí una fecha de cierre puntual: si esa fecha cae en el
// mes del `periodo` consultado, se funde con la planilla en vez de quedar solo visible en el reporte de
// aguinaldos por gestión (que se mantiene aparte para ver el detalle anual completo). `aguinaldo`/`filasAguinaldo`
// llegan null cuando no hay un aguinaldo cerrado ese mes.
function construirReportePlanilla({ planilla, filasConceptos, filasPasivos, aguinaldo = null, filasAguinaldo = null }) {
  const centrosPlanilla = agruparPorCentroDeCosto({ filasConceptos, filasPasivos });
  const centros_costo =
    aguinaldo && filasAguinaldo
      ? combinarCentros([centrosPlanilla, agruparAguinaldoPorCentroDeCosto(filasAguinaldo)])
      : centrosPlanilla;
  return {
    recurso: "PLANILLA",
    id_recurso: planilla.id_planilla,
    periodo: planilla.periodo,
    estado: planilla.estado,
    colaboradores: planilla.colaboradores,
    centros_costo,
    totales: totalesDe(centros_costo),
    conciliacion: conciliacionDe(planilla),
    aguinaldo_incluido: aguinaldo ? { id_aguinaldo: aguinaldo.id_aguinaldo, gestion: aguinaldo.gestion } : null,
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

module.exports = {
  NOMBRE_DESTINO,
  conciliacionDe,
  totalesDe,
  combinarCentros,
  construirReportePlanilla,
  construirReporteAguinaldo,
};
