const { aCentavos } = require("./calculo");
const { ErrorApp } = require("./errores");

const MESES_PROMEDIO = 3;
const DIAS_MES = 30;
const deCentavos = (centavos) => centavos / 100;

function periodoLimite(fechaRetiro) {
  return String(fechaRetiro ?? "").slice(0, 7);
}

function mesSiguiente(periodo) {
  const [anioStr, mesStr] = periodo.split("-");
  let anio = Number(anioStr);
  let mes = Number(mesStr) + 1;
  if (mes > 12) {
    mes = 1;
    anio += 1;
  }
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function construirObservaciones(mesesOrdenados, limite) {
  const observaciones = [];

  // AC2: informar si el colaborador tiene menos de 3 planillas cerradas.
  if (mesesOrdenados.length < MESES_PROMEDIO) {
    const n = mesesOrdenados.length;
    const palabraPlanilla = n === 1 ? "planilla cerrada" : "planillas cerradas";
    const palabraMes = n === 1 ? "1 mes" : `${n} meses`;
    observaciones.push(`Solo hay ${n} ${palabraPlanilla} del colaborador hasta ${limite}: el promedio se calculó con ${palabraMes}.`);
  }

  const masReciente = mesesOrdenados[mesesOrdenados.length - 1].periodo;
  if (masReciente < limite) {
    observaciones.push(`No hay una planilla cerrada de ${limite} (mes del retiro): si se cierra después, recalcule el promedio.`);
  }

  const faltantes = [];
  for (let i = 0; i < mesesOrdenados.length - 1; i += 1) {
    let cursor = mesSiguiente(mesesOrdenados[i].periodo);
    const siguiente = mesesOrdenados[i + 1].periodo;
    while (cursor < siguiente) {
      faltantes.push(cursor);
      cursor = mesSiguiente(cursor);
    }
  }
  if (faltantes.length === 1) {
    observaciones.push(`Los meses considerados no son consecutivos: falta la planilla cerrada de ${faltantes[0]}.`);
  } else if (faltantes.length > 1) {
    observaciones.push(`Los meses considerados no son consecutivos: faltan las planillas cerradas de ${faltantes.join(", ")}.`);
  }

  for (const mes of mesesOrdenados) {
    if (Number(mes.dias_pagados) < DIAS_MES) {
      observaciones.push(`En ${mes.periodo} se pagaron ${Number(mes.dias_pagados)} de ${DIAS_MES} días.`);
    }
  }

  return observaciones;
}

// AC1: promedia hasta las 3 últimas planillas cerradas hasta el mes del retiro.
// AC2: si hay menos de 3, promedia las disponibles e informa la observación.
function calcularPromedio(planillas, limite) {
  if (!Array.isArray(planillas) || planillas.length === 0) {
    throw new ErrorApp(
      409,
      `El colaborador no tiene planillas cerradas hasta ${limite}: no se puede calcular el sueldo promedio indemnizable.`,
      undefined,
      "SIN_PLANILLAS_CERRADAS"
    );
  }

  const recientes = [...planillas]
    .sort((a, b) => b.periodo.localeCompare(a.periodo))
    .slice(0, MESES_PROMEDIO);

  // El desglose se devuelve del más antiguo al más reciente.
  const mesesOrdenados = [...recientes].sort((a, b) => a.periodo.localeCompare(b.periodo));

  const sumaCentavos = mesesOrdenados.reduce((acc, m) => acc + aCentavos(Number(m.total_ganado)), 0);
  const promedioCentavos = Math.round(sumaCentavos / mesesOrdenados.length);

  return {
    periodo_limite: limite,
    meses_considerados: mesesOrdenados.length,
    total_considerado: deCentavos(sumaCentavos),
    promedio: deCentavos(promedioCentavos),
    observaciones: construirObservaciones(mesesOrdenados, limite),
    meses: mesesOrdenados.map((m) => ({
      periodo: m.periodo,
      id_planilla: m.id_planilla,
      id_planilla_empleado: m.id_planilla_empleado,
      dias_pagados: Number(m.dias_pagados),
      haber_mensual: deCentavos(aCentavos(Number(m.haber_mensual))),
      total_ganado: deCentavos(aCentavos(Number(m.total_ganado))),
    })),
  };
}

module.exports = {
  MESES_PROMEDIO,
  periodoLimite,
  calcularPromedio,
};
