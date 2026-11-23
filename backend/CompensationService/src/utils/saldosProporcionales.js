// Saldos proporcionales pendientes del finiquito (KAN-77): duodécimas de aguinaldo de la gestión en curso y
// vacaciones truncas (días no gozados + duodécima del año de servicio en curso), valorizados con el sueldo
// promedio indemnizable del proceso (RF-55).
const { rangoGestion, mesesYDias, MESES_MINIMOS } = require("./aguinaldo");
const { DIAS_MES_COMERCIAL } = require("./planillas");

const centavos = (valor) => Math.round(Number(valor) * 100);
const bs = (cents) => cents / 100;
const redondear2 = (valor) => Math.round((Number(valor) + Number.EPSILON) * 100) / 100;
const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;
const textoTiempo = ({ meses, dias }) => `${plural(meses, "mes", "meses")} y ${plural(dias, "día", "días")}`;

// Gestión del aguinaldo que contiene `fecha` (1 de diciembre del año anterior al 30 de noviembre).
function gestionDe(fecha) {
  const [anio, mes] = fecha.split("-").map(Number);
  return mes === 12 ? anio + 1 : anio;
}

// Monto de `unidades` (meses o días) de un sueldo mensual, sin redondear antes de tiempo: se multiplica en
// centavos y se redondea una sola vez al final.
const proporcion = (promedio, factor) => bs(Math.round(centavos(promedio) * factor));

// Criterio 1: duodécimas del aguinaldo de la gestión en curso al retiro, por los meses y días trabajados en
// ella (misma regla que la planilla de aguinaldos, RF-47). Sin pago si trabajó menos de 3 meses en la
// gestión, o si su aguinaldo de esa gestión ya se liquidó en la planilla de aguinaldos aprobada.
function duodecimaAguinaldo({ fechaIngreso, fechaRetiro, promedio, aguinaldoLiquidado = null }) {
  const gestion = gestionDe(fechaRetiro);
  const rango = rangoGestion(gestion);
  const tiempo = mesesYDias(fechaIngreso, fechaRetiro, rango) ?? { meses: 0, dias_resto: 0 };
  const base = {
    gestion,
    desde: fechaIngreso > rango.desde ? fechaIngreso : rango.desde,
    hasta: fechaRetiro,
    meses: tiempo.meses,
    dias: tiempo.dias_resto,
  };
  if (aguinaldoLiquidado) {
    return {
      ...base,
      monto: 0,
      observacion: `El aguinaldo de la gestión ${gestion} ya se liquidó en la planilla de aguinaldos (${aguinaldoLiquidado.monto.toFixed(2)} Bs): no se vuelve a pagar en el finiquito.`,
    };
  }
  if (tiempo.meses < MESES_MINIMOS) {
    return {
      ...base,
      monto: 0,
      observacion: `Sin duodécimas de aguinaldo: trabajó ${textoTiempo({ meses: tiempo.meses, dias: tiempo.dias_resto })} en la gestión ${gestion} y el mínimo es ${MESES_MINIMOS} meses.`,
    };
  }
  const factor = (tiempo.meses + tiempo.dias_resto / DIAS_MES_COMERCIAL) / 12;
  return { ...base, monto: proporcion(promedio, factor), observacion: null };
}

// Último aniversario de servicio cumplido a la fecha del retiro (o la fecha de ingreso, sin ninguno), según los
// períodos que acreditó el módulo de vacaciones.
function inicioAnioEnCurso(saldo, fechaIngreso) {
  const periodos = saldo.periodos ?? [];
  return periodos.length > 0 ? periodos[periodos.length - 1].fecha_acreditacion : fechaIngreso;
}

// Criterios 2 y 3: vacaciones truncas.
// - Pendientes: días acreditados por el módulo de vacaciones al día del retiro y no gozados (los que estaban
//   en proceso de goce también, porque con el retiro ya no se gozan).
// - Duodécima: el año de servicio que no llegó a completar, en proporción a los días de la escala que le
//   habrían correspondido al cumplirlo (15, 20 o 30, según la antigüedad; el módulo la informa en
//   proximo_periodo.dias).
// Ambos se valorizan con el sueldo promedio diario (promedio / 30).
function vacacionesTruncas({ saldo, fechaIngreso, fechaRetiro, promedio }) {
  const acumulados = Number(saldo.saldo?.acumulados ?? 0);
  const gozados = Number(saldo.saldo?.gozados ?? 0);
  const enProceso = Number(saldo.saldo?.en_proceso ?? 0);
  const diasPendientes = Math.max(acumulados - gozados, 0);

  const desde = inicioAnioEnCurso(saldo, fechaIngreso);
  const tiempo = mesesYDias(desde, fechaRetiro, { desde, hasta: fechaRetiro }) ?? { meses: 0, dias_resto: 0 };
  const diasEscala = Number(saldo.proximo_periodo?.dias ?? 0);
  const fraccionAnio = (tiempo.meses + tiempo.dias_resto / DIAS_MES_COMERCIAL) / 12;
  const diasDuodecima = redondear2(diasEscala * fraccionAnio);

  const observaciones = [];
  if (enProceso > 0) {
    observaciones.push(
      `${plural(enProceso, "día", "días")} de vacación en proceso de goce se pagan como no gozados: con el retiro ya no se gozarán.`
    );
  }
  return {
    anios_servicio: Number(saldo.anios_servicio ?? 0),
    dias_acumulados: acumulados,
    dias_gozados: gozados,
    dias_pendientes: diasPendientes,
    monto_pendientes: proporcion(promedio, diasPendientes / DIAS_MES_COMERCIAL),
    anio_en_curso: { desde, hasta: fechaRetiro, meses: tiempo.meses, dias: tiempo.dias_resto },
    dias_escala: diasEscala,
    dias_duodecima: diasDuodecima,
    monto_duodecima: proporcion(promedio, (diasEscala * fraccionAnio) / DIAS_MES_COMERCIAL),
    observaciones,
  };
}

// Resultado completo para guardar y mostrar.
function calcularSaldos({ promedio, fechaIngreso, fechaRetiro, saldoVacaciones, aguinaldoLiquidado }) {
  const salarioDiario = redondear2(promedio / DIAS_MES_COMERCIAL);
  const aguinaldo = duodecimaAguinaldo({ fechaIngreso, fechaRetiro, promedio, aguinaldoLiquidado });
  const vacaciones = vacacionesTruncas({ saldo: saldoVacaciones, fechaIngreso, fechaRetiro, promedio });
  const total = bs(centavos(aguinaldo.monto) + centavos(vacaciones.monto_pendientes) + centavos(vacaciones.monto_duodecima));
  return {
    promedio,
    salario_diario: salarioDiario,
    aguinaldo,
    vacaciones,
    total,
    observaciones: [aguinaldo.observacion, ...vacaciones.observaciones].filter(Boolean),
  };
}

module.exports = { gestionDe, duodecimaAguinaldo, vacacionesTruncas, calcularSaldos };
