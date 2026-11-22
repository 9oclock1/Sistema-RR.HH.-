const { aCentavos } = require("./calculo");

const CODIGOS_PARAMETRO = {
  SALARIO_MINIMO: "SALARIO_MINIMO_NACIONAL",
  MULTIPLO: "MULTIPLO_MINIMO_NO_IMPONIBLE",
  ALICUOTA_RCIVA: "ALICUOTA_RCIVA",
  ALICUOTA_CREDITO: "ALICUOTA_CREDITO_FISCAL",
};

const ESCALA_PORCENTAJE = 10000;

const deCentavos = (centavos) => centavos / 100;

const porcentajeDe = (centavos, porcentaje) => {
  const factor = Math.round(porcentaje * ESCALA_PORCENTAJE);
  return Math.floor((centavos * factor * 2 + 100 * ESCALA_PORCENTAJE) / (200 * ESCALA_PORCENTAJE));
};

function resolverParametros(filas) {
  const valores = new Map(filas.map((fila) => [fila.codigo, Number(fila.valor)]));
  const faltantes = Object.values(CODIGOS_PARAMETRO).filter((codigo) => !valores.has(codigo));
  if (faltantes.length > 0) return { faltantes };

  const salarioMinimo = valores.get(CODIGOS_PARAMETRO.SALARIO_MINIMO);
  const multiplo = valores.get(CODIGOS_PARAMETRO.MULTIPLO);
  return {
    faltantes: [],
    salarioMinimo,
    multiplo,
    minimoNoImponible: deCentavos(Math.round(aCentavos(salarioMinimo) * multiplo)),
    alicuotaRciva: valores.get(CODIGOS_PARAMETRO.ALICUOTA_RCIVA),
    alicuotaCredito: valores.get(CODIGOS_PARAMETRO.ALICUOTA_CREDITO),
  };
}

function calcularRetencion({ totalGanado, aportesLaborales, montoFacturas = 0, saldoAnterior = 0 }, parametros) {
  const ganado = aCentavos(totalGanado);
  const aportes = aCentavos(aportesLaborales);
  const sueldoNeto = Math.max(0, ganado - aportes);
  const base = Math.max(0, sueldoNeto - aCentavos(parametros.minimoNoImponible));
  const impuesto = porcentajeDe(base, parametros.alicuotaRciva);
  const creditoFacturas = porcentajeDe(aCentavos(montoFacturas), parametros.alicuotaCredito);
  const saldoPrevio = aCentavos(saldoAnterior);
  const disponible = creditoFacturas + saldoPrevio;
  const aplicado = Math.min(impuesto, disponible);

  return {
    total_ganado: deCentavos(ganado),
    aportes_laborales: deCentavos(aportes),
    sueldo_neto: deCentavos(sueldoNeto),
    base_imponible: deCentavos(base),
    impuesto_determinado: deCentavos(impuesto),
    monto_facturas: deCentavos(aCentavos(montoFacturas)),
    credito_fiscal_facturas: deCentavos(creditoFacturas),
    saldo_anterior_favor: deCentavos(saldoPrevio),
    credito_aplicado: deCentavos(aplicado),
    impuesto_retenido: deCentavos(impuesto - aplicado),
    saldo_favor_siguiente: deCentavos(disponible - aplicado),
  };
}

function resumirRetenciones(retenciones) {
  const sumar = (campo) => deCentavos(retenciones.reduce((total, r) => total + aCentavos(r[campo]), 0));
  return {
    cantidad_dependientes: retenciones.length,
    dependientes_con_retencion: retenciones.filter((r) => r.impuesto_retenido > 0).length,
    total_sueldo_neto: sumar("sueldo_neto"),
    total_base_imponible: sumar("base_imponible"),
    total_impuesto_determinado: sumar("impuesto_determinado"),
    total_credito_aplicado: sumar("credito_aplicado"),
    total_impuesto_retenido: sumar("impuesto_retenido"),
  };
}

module.exports = { CODIGOS_PARAMETRO, resolverParametros, calcularRetencion, resumirRetenciones, porcentajeDe, deCentavos };
