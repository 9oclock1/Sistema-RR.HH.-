// Cálculo de haberes, descuentos de ley y líquido pagable de un colaborador (KAN-64).
// Los valores salen de las vigencias de los conceptos (KAN-62); cada renglón guarda la vigencia que usó.
const { aniosDeServicio } = require("./fechas");
const { tramoParaAnios } = require("./antiguedad");

// Valor de la hora = haber mensual / (30 días × 8 horas).
const HORAS_MES = 240;
const DIAS_MES = 30;

// Conceptos que la planilla calcula con las novedades del mes (no se aplican como conceptos generales).
const CALCULADOS = {
  HABER: "HABER-BASICO",
  EXTRA: "HORAS-EXTRA",
  DOMINICAL: "DOMINICAL",
  NOCTURNO: "RECARGO-NOCTURNO",
  ANTIGUEDAD: "BONO-ANTIGUEDAD",
};
const CUOTA = "CUOTA-PRESTAMO";
// Aporte Nacional Solidario (Ley 065): cada tramo se aplica sobre lo que el total ganado supera su umbral.
const TRAMOS_ANS = [
  { codigo: "ANS-13000", umbral: 13000 },
  { codigo: "ANS-25000", umbral: 25000 },
  { codigo: "ANS-35000", umbral: 35000 },
];
const CODIGOS_CALCULADOS = new Set([...Object.values(CALCULADOS), ...TRAMOS_ANS.map((t) => t.codigo)]);

// Redondeo: cada renglón a centavos (mitad hacia arriba); los totales son la suma de los renglones redondeados.
const aCentavos = (monto) => Math.round((monto + Number.EPSILON) * 100);
const deCentavos = (centavos) => centavos / 100;
const dosDecimales = (valor) => deCentavos(aCentavos(valor));
const sumaCentavos = (renglones) => renglones.reduce((total, r) => total + aCentavos(r.resultado), 0);

const montoTexto = (valor) => `Bs ${valor.toLocaleString("es-BO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const horasTexto = (horas) => `${horas.toLocaleString("es-BO", { maximumFractionDigits: 2 })} h`;

function renglon(concepto, { base = null, cantidad = null, resultado, detalle = null }) {
  return {
    id_vigencia: concepto.id_vigencia,
    tipo: concepto.tipo,
    codigo: concepto.codigo,
    nombre: concepto.nombre,
    forma_calculo: concepto.forma_calculo,
    base: base === null ? null : dosDecimales(base),
    cantidad: cantidad === null ? null : dosDecimales(cantidad),
    valor: concepto.valor,
    resultado: dosDecimales(resultado),
    detalle,
  };
}

const faltaConcepto = (codigo, que) => `Falta el concepto ${codigo} activo con valor en el mes: no se calculó ${que}.`;

// Horas pagadas por hora (extra, dominical o nocturna): valor de la hora × porcentaje del concepto.
function porHoras(concepto, { minutos, valorHora, factor, alertas, que }) {
  if (minutos <= 0) return null;
  if (!concepto) {
    alertas.push(faltaConcepto(que.codigo, que.texto));
    return null;
  }
  const horas = minutos / 60;
  return renglon(concepto, {
    base: valorHora,
    cantidad: horas,
    resultado: horas * valorHora * factor(concepto.valor),
    detalle: `${horasTexto(dosDecimales(horas))} a ${montoTexto(dosDecimales(valorHora))} la hora`,
  });
}

// Bono por condición especial (KAN-72): monto fijo ya calculado, o porcentaje del haber mensual por su factor.
function renglonBono(n, haber) {
  const concepto = { ...n, tipo: "INGRESO" };
  if (n.forma_calculo === "MONTO_FIJO") {
    return renglon(concepto, { cantidad: n.cantidad, resultado: n.monto, detalle: n.detalle });
  }
  return renglon(concepto, { base: haber, cantidad: n.cantidad, resultado: haber * (n.valor / 100) * n.factor, detalle: n.detalle });
}

function antiguedadDelColaborador(escala, fechaIngreso, periodo) {
  if (!escala) return { alerta: "No hay una escala de antigüedad vigente en el mes: no se calculó el bono de antigüedad." };
  if (!fechaIngreso) return { alerta: "El colaborador no tiene fecha de ingreso registrada: no se calculó el bono de antigüedad." };
  const anios = aniosDeServicio(fechaIngreso, periodo);
  const tramo = tramoParaAnios(escala.tramos, anios);
  return { anios, porcentaje: tramo ? Number(tramo.porcentaje) : null };
}

function renglonAntiguedad({ anios, porcentaje }, haber, dias) {
  const concepto = {
    id_vigencia: null,
    tipo: "INGRESO",
    codigo: CALCULADOS.ANTIGUEDAD,
    nombre: "Bono de antigüedad",
    forma_calculo: "PORCENTAJE",
    valor: porcentaje,
  };
  return renglon(concepto, {
    base: haber,
    cantidad: dias,
    resultado: haber * (porcentaje / 100) * (dias / DIAS_MES),
    detalle: `${anios} años de servicio · ${dias} de ${DIAS_MES} días`,
  });
}

function renglonCuota(cuota) {
  const concepto = {
    id_vigencia: null,
    tipo: "DESCUENTO",
    codigo: CUOTA,
    nombre: cuota.tipo === "ANTICIPO" ? "Cuota de anticipo de sueldo" : "Cuota de préstamo",
    forma_calculo: "MONTO_FIJO",
    valor: cuota.monto,
  };
  return renglon(concepto, { resultado: cuota.monto, detalle: `Cuota n.º ${cuota.numero_cuota}` });
}

// Concepto general (aplica a todos): monto fijo de ingreso por días pagados, de descuento o aporte completo;
// porcentaje sobre el haber básico ganado o el total ganado.
function renglonGeneral(c, { dias, haberGanado, totalGanado }) {
  if (c.forma_calculo === "MONTO_FIJO") {
    if (c.tipo === "INGRESO") {
      return renglon(c, { cantidad: dias, resultado: c.valor * (dias / DIAS_MES), detalle: `${dias} de ${DIAS_MES} días` });
    }
    return renglon(c, { resultado: c.valor });
  }
  const base = c.base_calculo === "TOTAL_GANADO" ? totalGanado : haberGanado;
  return renglon(c, { base, resultado: base * (c.valor / 100) });
}

const ordenCodigo = (a, b) => a.codigo.localeCompare(b.codigo);

// Calcula un colaborador de la planilla. `conceptos`: activos con vigencia en el mes ({ es_condicion } marca los
// conceptos de condiciones especiales, que llegan como bonos). Devuelve renglones, totales y alertas.
function calcularEmpleado(fila, conceptos) {
  const porCodigo = new Map(conceptos.map((c) => [c.codigo, c]));
  const generales = conceptos.filter((c) => !CODIGOS_CALCULADOS.has(c.codigo) && !c.es_condicion).sort(ordenCodigo);
  const alertas = [];
  const haber = fila.haber_mensual;
  const dias = fila.dias_pagados;
  const valorHora = haber / HORAS_MES;

  // Ingresos
  const ingresos = [];
  const conceptoHaber = porCodigo.get(CALCULADOS.HABER);
  if (conceptoHaber) {
    ingresos.push(
      renglon(conceptoHaber, {
        base: haber,
        cantidad: dias,
        resultado: haber * (conceptoHaber.valor / 100) * (dias / DIAS_MES),
        detalle: `${dias} de ${DIAS_MES} días`,
      })
    );
  } else {
    alertas.push(faltaConcepto(CALCULADOS.HABER, "el haber básico"));
  }
  const haberGanado = ingresos[0]?.resultado ?? 0;
  if (fila.antiguedad?.alerta) alertas.push(fila.antiguedad.alerta);
  else if (fila.antiguedad?.porcentaje) ingresos.push(renglonAntiguedad(fila.antiguedad, haber, dias));
  const recargo = (valor) => 1 + valor / 100;
  const adicional = (valor) => valor / 100;
  ingresos.push(
    ...[
      porHoras(porCodigo.get(CALCULADOS.EXTRA), {
        minutos: fila.minutos_extra_habil + fila.minutos_extra_domingo + fila.minutos_extra_feriado,
        valorHora,
        factor: recargo,
        alertas,
        que: { codigo: CALCULADOS.EXTRA, texto: "el pago de horas extra" },
      }),
      porHoras(porCodigo.get(CALCULADOS.DOMINICAL), {
        minutos: fila.minutos_domingo + fila.minutos_feriado + fila.minutos_descanso,
        valorHora,
        factor: adicional,
        alertas,
        que: { codigo: CALCULADOS.DOMINICAL, texto: "el pago de domingos, feriados y descansos trabajados" },
      }),
      porHoras(porCodigo.get(CALCULADOS.NOCTURNO), {
        minutos: fila.minutos_nocturnos,
        valorHora,
        factor: adicional,
        alertas,
        que: { codigo: CALCULADOS.NOCTURNO, texto: "el recargo nocturno" },
      }),
    ].filter(Boolean),
    ...fila.novedades.map((n) => renglonBono(n, haber))
  );
  // Ingresos generales: un porcentaje del total ganado se toma sobre los ingresos anteriores.
  for (const c of generales.filter((g) => g.tipo === "INGRESO")) {
    ingresos.push(renglonGeneral(c, { dias, haberGanado, totalGanado: deCentavos(sumaCentavos(ingresos)) }));
  }
  const totalGanado = deCentavos(sumaCentavos(ingresos));

  // Descuentos: generales (aportes laborales, retenciones) y Aporte Nacional Solidario por tramo.
  const contexto = { dias, haberGanado, totalGanado };
  const descuentos = generales.filter((g) => g.tipo === "DESCUENTO").map((c) => renglonGeneral(c, contexto));
  for (const tramo of TRAMOS_ANS) {
    const excedente = totalGanado - tramo.umbral;
    if (excedente <= 0) continue;
    const concepto = porCodigo.get(tramo.codigo);
    if (!concepto) {
      alertas.push(faltaConcepto(tramo.codigo, "el Aporte Nacional Solidario"));
      continue;
    }
    descuentos.push(
      renglon(concepto, {
        base: excedente,
        resultado: excedente * (concepto.valor / 100),
        detalle: `Excedente de ${montoTexto(tramo.umbral)}`,
      })
    );
  }
  descuentos.push(...(fila.cuotas ?? []).map(renglonCuota));
  // Aportes patronales: no se descuentan al colaborador.
  const aportes = generales.filter((g) => g.tipo === "APORTE").map((c) => renglonGeneral(c, contexto));

  const conResultado = (r) => r.resultado > 0 || r.codigo === CALCULADOS.HABER;
  const renglones = [...ingresos, ...descuentos.filter(conResultado), ...aportes.filter(conResultado)].map((r, i) => ({
    ...r,
    orden: i + 1,
  }));
  const totalDescuentos = deCentavos(sumaCentavos(descuentos));
  const resultado = {
    renglones,
    total_ganado: totalGanado,
    total_descuentos: totalDescuentos,
    liquido_pagable: deCentavos(aCentavos(totalGanado) - aCentavos(totalDescuentos)),
    total_aportes: deCentavos(sumaCentavos(aportes)),
  };
  return { ...resultado, alertas: [...alertas, ...validarConsistencia(resultado, fila)] };
}

// Criterio 3: líquido negativo o totales que no cuadran con el detalle marcan al colaborador con una alerta.
function validarConsistencia({ renglones, total_ganado, total_descuentos, liquido_pagable, total_aportes }, fila) {
  const alertas = [];
  if (liquido_pagable < 0) {
    alertas.push(`El líquido pagable es negativo (${montoTexto(liquido_pagable)}): los descuentos superan el total ganado.`);
  }
  const suma = (tipo) => sumaCentavos(renglones.filter((r) => r.tipo === tipo));
  const cuadra =
    suma("INGRESO") === aCentavos(total_ganado) &&
    suma("DESCUENTO") === aCentavos(total_descuentos) &&
    suma("APORTE") === aCentavos(total_aportes) &&
    aCentavos(total_ganado) - aCentavos(total_descuentos) === Math.round(liquido_pagable * 100);
  if (!cuadra) alertas.push("Los totales no cuadran con el detalle del cálculo.");
  if (fila.dias_pagados > 0 && total_ganado <= 0) {
    alertas.push(`El total ganado es cero aunque tiene ${fila.dias_pagados} días pagados.`);
  }
  return alertas;
}

module.exports = {
  HORAS_MES,
  CALCULADOS,
  CUOTA,
  TRAMOS_ANS,
  aCentavos,
  dosDecimales,
  antiguedadDelColaborador,
  calcularEmpleado,
  validarConsistencia,
};
