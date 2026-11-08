const { ErrorApp } = require("./errores");
const { esFecha, esPrimerDiaDeMes, sumarMeses, hoyLaPaz } = require("./fechas");
const { UUID_RE } = require("./formatos");

const TIPOS = ["ANTICIPO", "PRESTAMO"];
const MAX_CUOTAS = 60;
const MONTO_MAXIMO = 999999.99;
const CUOTA_MINIMA = 0.01;

// Primer día del mes actual (Bolivia), para no aceptar préstamos que ya deberían haber empezado a descontarse.
const primerDiaMesActual = () => `${hoyLaPaz().slice(0, 7)}-01`;

// Tope legal de referencia: ninguna cuota puede comprometer más del 20% del líquido pagable del colaborador.
// Es una regla de negocio configurable, no un valor fijo del dominio; ajústese si cambia la normativa.
const PORCENTAJE_MAXIMO_DESCUENTO = 20;

function lanzarSiHayErrores(mensaje, errores) {
  if (errores.length > 0) throw new ErrorApp(400, mensaje, errores);
}

// Hasta 2 decimales, como cualquier monto en bolivianos.
const esMontoValido = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) && valor > 0 && valor <= MONTO_MAXIMO && /^\d+(\.\d{1,2})?$/.test(String(valor));

function validarDatosPrestamo(datos = {}) {
  const errores = [];
  const agregar = (campo, mensaje) => errores.push({ campo, mensaje });
  const { id_empleado, tipo, monto, numero_cuotas, mes_inicio, motivo } = datos;

  if (typeof id_empleado !== "string" || !UUID_RE.test(id_empleado.trim())) {
    agregar("id_empleado", "Seleccione el colaborador.");
  }
  if (!TIPOS.includes(tipo)) agregar("tipo", "Seleccione anticipo o préstamo.");

  let montoValido = esMontoValido(monto);
  if (!montoValido) agregar("monto", "Ingrese un monto mayor a 0, con hasta 2 decimales.");

  const cuotasEnRango = Number.isInteger(numero_cuotas) && numero_cuotas >= 1 && numero_cuotas <= MAX_CUOTAS;
  if (!cuotasEnRango) {
    agregar("numero_cuotas", `Ingrese un número de cuotas entre 1 y ${MAX_CUOTAS}.`);
  } else if (montoValido && monto < numero_cuotas * CUOTA_MINIMA) {
    agregar("numero_cuotas", `El monto es muy bajo para ${numero_cuotas} cuotas: cada cuota debe ser de al menos Bs ${CUOTA_MINIMA.toFixed(2)}.`);
  }

  if (!esFecha(mes_inicio)) agregar("mes_inicio", "Ingrese una fecha válida.");
  else if (!esPrimerDiaDeMes(mes_inicio)) agregar("mes_inicio", "Use el primer día del mes en que empieza a descontarse.");
  else if (mes_inicio < primerDiaMesActual()) agregar("mes_inicio", "El mes de inicio no puede ser anterior al mes actual.");

  const motivoTexto = typeof motivo === "string" ? motivo.trim() : "";
  if (motivoTexto.length > 250) agregar("motivo", "Use hasta 250 caracteres.");

  lanzarSiHayErrores("Datos del anticipo o préstamo inválidos", errores);
  return {
    id_empleado: id_empleado.trim(),
    tipo,
    monto,
    numero_cuotas,
    mes_inicio,
    motivo: motivoTexto || null,
  };
}

// Reparte el monto en cuotas iguales, con la última cuota absorbiendo el redondeo para que la suma cuadre
// exactamente con el monto solicitado.
function calcularCuotas({ monto, numero_cuotas, mes_inicio }) {
  const base = Math.floor((monto / numero_cuotas) * 100) / 100;
  const cuotas = [];
  let acumulado = 0;
  for (let numero = 1; numero <= numero_cuotas; numero += 1) {
    const esUltima = numero === numero_cuotas;
    const importe = esUltima ? Math.round((monto - acumulado) * 100) / 100 : base;
    acumulado += importe;
    cuotas.push({ numero_cuota: numero, periodo: sumarMeses(mes_inicio, numero - 1), monto: importe });
  }
  return cuotas;
}

// La cuota más alta del plan es la que define cuánto se compromete del líquido pagable.
function cuotaMaxima(cuotas) {
  return cuotas.reduce((max, c) => Math.max(max, c.monto), 0);
}

// La cuota más alta ya SUMADA a lo que el colaborador tiene comprometido ese mismo mes en otros
// préstamos activos: dos préstamos pequeños pueden superar el tope aunque ninguno lo supere por sí solo.
function cuotaMaximaComprometida(cuotas, comprometidoPorPeriodo) {
  return cuotas.reduce((max, c) => Math.max(max, c.monto + (comprometidoPorPeriodo[c.periodo] || 0)), 0);
}

// Rechaza el plan si alguna cuota, sumada a lo ya comprometido ese mes en otros préstamos activos del
// mismo colaborador, supera el porcentaje máximo permitido sobre el líquido pagable.
function validarTopeDescuento(cuotas, liquidoPagable, comprometidoPorPeriodo = {}) {
  const maxima = cuotaMaximaComprometida(cuotas, comprometidoPorPeriodo);
  const limite = Math.round(liquidoPagable * (PORCENTAJE_MAXIMO_DESCUENTO / 100) * 100) / 100;
  if (maxima > limite) {
    throw new ErrorApp(400, "La cuota supera el límite de descuento permitido", [
      {
        campo: "numero_cuotas",
        mensaje:
          `La cuota de Bs ${maxima.toFixed(2)} (incluyendo otros préstamos activos del colaborador) supera el ` +
          `${PORCENTAJE_MAXIMO_DESCUENTO}% del líquido pagable (máximo Bs ${limite.toFixed(2)}). ` +
          `Aumente el número de cuotas o reduzca el monto.`,
      },
    ]);
  }
  return { porcentaje_cuota: Math.round((cuotaMaxima(cuotas) / liquidoPagable) * 10000) / 100, limite };
}

// Los periodos deben cerrarse en orden cronológico: si queda un periodo anterior con cuotas pendientes,
// cerrar uno posterior dejaría ese anterior "huérfano" y descontaría cuotas de meses que el colaborador
// todavía no trabajó. periodoPendienteMasAntiguo es null cuando no hay ninguna cuota pendiente.
function validarOrdenCierre(periodo, periodoPendienteMasAntiguo) {
  if (periodoPendienteMasAntiguo && periodo > periodoPendienteMasAntiguo) {
    throw new ErrorApp(409, "Existen periodos anteriores con cuotas pendientes", [
      {
        campo: "periodo",
        mensaje: `Cierre primero el periodo ${periodoPendienteMasAntiguo}. Los periodos deben cerrarse en orden cronológico.`,
      },
    ]);
  }
}

module.exports = {
  TIPOS,
  MAX_CUOTAS,
  PORCENTAJE_MAXIMO_DESCUENTO,
  CUOTA_MINIMA,
  validarDatosPrestamo,
  validarOrdenCierre,
  calcularCuotas,
  cuotaMaxima,
  validarTopeDescuento,
};
