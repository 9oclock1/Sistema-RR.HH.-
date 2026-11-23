const { aCentavos } = require("./calculo");
const { ErrorApp } = require("./errores");
const { sumarDias } = require("./fechas");

const DIA_MS = 24 * 60 * 60 * 1000;
// Más de 90 días de trabajo continuo dan derecho a la indemnización (DS 110).
const DIAS_MINIMOS = 90;
const DIVISORES = { ANIO: 1, MES: 12, DIA: 360, SUELDO: 1 };
const SUELDOS_DESAHUCIO = 3;
// Despido por causa justificada: no hay indemnización ni desahucio (LGT, art. 16).
const CAUSALES_SIN_INDEMNIZACION = new Set(["DESPIDO_LEGAL"]);

const deCentavos = (centavos) => centavos / 100;
const dos = (n) => String(n).padStart(2, "0");
const plural = (n, singular, varios) => `${n} ${n === 1 ? singular : varios}`;

const diasEntre = (desde, hasta) =>
  Math.round((Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / DIA_MS);

// Mismo día `n` meses después; si ese mes es más corto, el último día del mes.
function sumarMesesCalendario(fecha, n) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const indice = anio * 12 + (mes - 1) + n;
  const anioNuevo = Math.floor(indice / 12);
  const mesNuevo = (indice % 12) + 1;
  const ultimoDia = new Date(Date.UTC(anioNuevo, mesNuevo, 0)).getUTCDate();
  return `${anioNuevo}-${dos(mesNuevo)}-${dos(Math.min(dia, ultimoDia))}`;
}

// Cuenta el día de ingreso y el de retiro: del 1 de noviembre al 31 de octubre siguiente es 1 año exacto.
function tiempoDeServicio(fechaIngreso, fechaRetiro) {
  const fin = sumarDias(fechaRetiro, 1);
  let mesesCompletos = 0;
  while (sumarMesesCalendario(fechaIngreso, mesesCompletos + 1) <= fin) mesesCompletos += 1;
  return {
    dias_servicio: diasEntre(fechaIngreso, fin),
    anios: Math.floor(mesesCompletos / 12),
    meses: mesesCompletos % 12,
    dias: diasEntre(sumarMesesCalendario(fechaIngreso, mesesCompletos), fin),
  };
}

function reglaIndemnizacion(codigoCausal, diasServicio) {
  if (CAUSALES_SIN_INDEMNIZACION.has(codigoCausal)) {
    return {
      corresponde: false,
      motivo: "Despido por causa justificada: no corresponde indemnización (LGT, art. 16).",
    };
  }
  if (diasServicio <= DIAS_MINIMOS) {
    return {
      corresponde: false,
      motivo: `${plural(diasServicio, "día", "días")} de servicio (${DIAS_MINIMOS} o menos): no corresponde indemnización (DS 110).`,
    };
  }
  return {
    corresponde: true,
    motivo: `${diasServicio} días de servicio (más de ${DIAS_MINIMOS}): un sueldo promedio por año, más la parte proporcional de meses y días (LGT, art. 13; DS 110).`,
  };
}

// AC3, AC4: el desahucio sale de corresponde_desahucio, copiado de la causal al registrar la baja (KAN-74).
function reglaDesahucio(proceso, diasServicio) {
  if (CAUSALES_SIN_INDEMNIZACION.has(proceso.codigo_causal)) {
    return {
      corresponde: false,
      motivo: "Despido por causa justificada: no corresponde desahucio (LGT, art. 16).",
    };
  }
  if (!proceso.corresponde_desahucio) {
    const causal = proceso.causal_nombre ? `«${proceso.causal_nombre}»` : "registrada";
    return { corresponde: false, motivo: `La causal ${causal} no da lugar a desahucio.` };
  }
  if (diasServicio <= DIAS_MINIMOS) {
    return {
      corresponde: false,
      motivo: `Retiro dentro del período de prueba de ${DIAS_MINIMOS} días: no corresponde desahucio (LGT, art. 13).`,
    };
  }
  return {
    corresponde: true,
    motivo: `Retiro sin causa justificada: corresponden ${SUELDOS_DESAHUCIO} sueldos promedio (LGT, art. 12).`,
  };
}

function renglon(concepto, unidad, cantidad, descripcion, baseCentavos) {
  const divisor = DIVISORES[unidad];
  return {
    codigo_concepto: concepto,
    descripcion,
    unidad,
    cantidad,
    divisor,
    centavos: Math.round((baseCentavos * cantidad) / divisor),
  };
}

// AC1, AC2: indemnización = promedio × años + promedio × meses / 12 + promedio × días / 360.
function calcularBeneficios(proceso, promedio) {
  if (!proceso.fecha_ingreso) {
    throw new ErrorApp(
      409,
      "El proceso no tiene fecha de ingreso del colaborador: no se puede calcular el tiempo de servicio.",
      undefined,
      "SIN_FECHA_INGRESO"
    );
  }

  const tiempo = tiempoDeServicio(proceso.fecha_ingreso, proceso.fecha_retiro);
  const baseCentavos = aCentavos(Number(promedio));
  const indemnizacion = reglaIndemnizacion(proceso.codigo_causal, tiempo.dias_servicio);
  const desahucio = reglaDesahucio(proceso, tiempo.dias_servicio);

  const renglones = [];
  if (indemnizacion.corresponde) {
    const partes = [
      ["ANIO", tiempo.anios, "Años de servicio"],
      ["MES", tiempo.meses, "Meses de servicio (duodécimas)"],
      ["DIA", tiempo.dias, "Días de servicio"],
    ];
    for (const [unidad, cantidad, descripcion] of partes) {
      if (cantidad > 0) renglones.push(renglon("INDEMNIZACION", unidad, cantidad, descripcion, baseCentavos));
    }
  }
  if (desahucio.corresponde) {
    renglones.push(
      renglon("DESAHUCIO", "SUELDO", SUELDOS_DESAHUCIO, "Desahucio (tres sueldos promedio)", baseCentavos)
    );
  }

  const sumar = (concepto) =>
    renglones.filter((r) => r.codigo_concepto === concepto).reduce((total, r) => total + r.centavos, 0);
  const indemnizacionCentavos = sumar("INDEMNIZACION");
  const desahucioCentavos = sumar("DESAHUCIO");

  return {
    promedio_base: deCentavos(baseCentavos),
    fecha_ingreso: proceso.fecha_ingreso,
    fecha_retiro: proceso.fecha_retiro,
    dias_servicio: tiempo.dias_servicio,
    anios_servicio: tiempo.anios,
    meses_servicio: tiempo.meses,
    dias_fraccion: tiempo.dias,
    corresponde_indemnizacion: indemnizacion.corresponde,
    motivo_indemnizacion: indemnizacion.motivo,
    monto_indemnizacion: deCentavos(indemnizacionCentavos),
    corresponde_desahucio: desahucio.corresponde,
    motivo_desahucio: desahucio.motivo,
    monto_desahucio: deCentavos(desahucioCentavos),
    total: deCentavos(indemnizacionCentavos + desahucioCentavos),
    renglones: renglones.map(({ centavos, ...r }, i) => ({ orden: i + 1, ...r, monto: deCentavos(centavos) })),
  };
}

module.exports = {
  DIAS_MINIMOS,
  SUELDOS_DESAHUCIO,
  tiempoDeServicio,
  reglaIndemnizacion,
  reglaDesahucio,
  calcularBeneficios,
};
