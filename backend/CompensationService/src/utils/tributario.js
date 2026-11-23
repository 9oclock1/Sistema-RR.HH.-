const { aCentavos } = require("./calculo");

const CODIGOS_PARAMETRO = {
  SALARIO_MINIMO: "SALARIO_MINIMO_NACIONAL",
  MULTIPLO: "MULTIPLO_MINIMO_NO_IMPONIBLE",
  ALICUOTA_RCIVA: "ALICUOTA_RCIVA",
  ALICUOTA_CREDITO: "ALICUOTA_CREDITO_FISCAL",
};

const ORIGEN_SALDO = { MES_ANTERIOR: "MES_ANTERIOR", SALDO_INICIAL: "SALDO_INICIAL" };

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
  const alicuotaRciva = valores.get(CODIGOS_PARAMETRO.ALICUOTA_RCIVA);
  const minimoNoImponible = Math.round(aCentavos(salarioMinimo) * multiplo);
  return {
    faltantes: [],
    salarioMinimo,
    multiplo,
    minimoNoImponible: deCentavos(minimoNoImponible),
    computoSalariosMinimos: deCentavos(porcentajeDe(minimoNoImponible, alicuotaRciva)),
    alicuotaRciva,
    alicuotaCredito: valores.get(CODIGOS_PARAMETRO.ALICUOTA_CREDITO),
  };
}

function actualizarConUfv(centavos, ufv) {
  if (!ufv || centavos === 0) return centavos;
  const inicial = Number(ufv.inicial);
  const final = Number(ufv.final);
  if (!(inicial > 0) || !(final > inicial)) return centavos;
  return Math.round((centavos * final) / inicial);
}

function calcularRetencion(
  { totalGanado, aportesLaborales, montoFacturas = 0, saldoMesAnterior = 0, ufv = null },
  parametros
) {
  const ganado = aCentavos(totalGanado);
  const aportes = aCentavos(aportesLaborales);
  const sueldoNeto = Math.max(0, ganado - aportes);
  const base = Math.max(0, sueldoNeto - aCentavos(parametros.minimoNoImponible));
  const impuesto = porcentajeDe(base, parametros.alicuotaRciva);
  const computo = Math.min(impuesto, aCentavos(parametros.computoSalariosMinimos));
  const impuestoTrasComputo = impuesto - computo;

  const creditoFacturas = porcentajeDe(aCentavos(montoFacturas), parametros.alicuotaCredito);
  const saldoPrevio = aCentavos(saldoMesAnterior);
  const saldoActualizado = actualizarConUfv(saldoPrevio, ufv);
  const disponible = creditoFacturas + saldoActualizado;
  const aplicado = Math.min(impuestoTrasComputo, disponible);

  return {
    total_ganado: deCentavos(ganado),
    aportes_laborales: deCentavos(aportes),
    sueldo_neto: deCentavos(sueldoNeto),
    base_imponible: deCentavos(base),
    impuesto_determinado: deCentavos(impuesto),
    computo_salarios_minimos: deCentavos(computo),
    monto_facturas: deCentavos(aCentavos(montoFacturas)),
    credito_fiscal_facturas: deCentavos(creditoFacturas),
    saldo_mes_anterior: deCentavos(saldoPrevio),
    actualizacion_ufv: deCentavos(saldoActualizado - saldoPrevio),
    saldo_anterior_favor: deCentavos(saldoActualizado),
    credito_aplicado: deCentavos(aplicado),
    impuesto_retenido: deCentavos(impuestoTrasComputo - aplicado),
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
    total_computo_salarios_minimos: sumar("computo_salarios_minimos"),
    total_credito_aplicado: sumar("credito_aplicado"),
    total_impuesto_retenido: sumar("impuesto_retenido"),
    total_actualizacion_ufv: sumar("actualizacion_ufv"),
  };
}

function periodoAnterior(periodo) {
  const [anio, mes] = periodo.split("-").map(Number);
  return mes === 1 ? `${anio - 1}-12` : `${anio}-${String(mes - 1).padStart(2, "0")}`;
}

function finDePeriodo(periodo) {
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
}

module.exports = {
  CODIGOS_PARAMETRO,
  ORIGEN_SALDO,
  resolverParametros,
  calcularRetencion,
  resumirRetenciones,
  porcentajeDe,
  deCentavos,
  actualizarConUfv,
  periodoAnterior,
  finDePeriodo,
};
