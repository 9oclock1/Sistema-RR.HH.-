const { ErrorApp } = require("./errores");
const { esFecha, esPrimerDiaDeMes, sumarMeses } = require("./fechas");

const TIPOS = ["ANTICIPO", "PRESTAMO"];
const MAX_CUOTAS = 60;
const MONTO_MAXIMO = 999999.99;

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

  if (typeof id_empleado !== "string" || !id_empleado.trim()) {
    agregar("id_empleado", "Seleccione el colaborador.");
  }
  if (!TIPOS.includes(tipo)) agregar("tipo", "Seleccione anticipo o préstamo.");
  if (!esMontoValido(monto)) agregar("monto", "Ingrese un monto mayor a 0, con hasta 2 decimales.");
  if (!Number.isInteger(numero_cuotas) || numero_cuotas < 1 || numero_cuotas > MAX_CUOTAS) {
    agregar("numero_cuotas", `Ingrese un número de cuotas entre 1 y ${MAX_CUOTAS}.`);
  }
  if (!esFecha(mes_inicio)) agregar("mes_inicio", "Ingrese una fecha válida.");
  else if (!esPrimerDiaDeMes(mes_inicio)) agregar("mes_inicio", "Use el primer día del mes en que empieza a descontarse.");

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

// Rechaza el plan si alguna cuota supera el porcentaje máximo permitido sobre el líquido pagable.
function validarTopeDescuento(cuotas, liquidoPagable) {
  const maxima = cuotaMaxima(cuotas);
  const limite = Math.round(liquidoPagable * (PORCENTAJE_MAXIMO_DESCUENTO / 100) * 100) / 100;
  if (maxima > limite) {
    throw new ErrorApp(400, "La cuota supera el límite de descuento permitido", [
      {
        campo: "numero_cuotas",
        mensaje:
          `La cuota de Bs ${maxima.toFixed(2)} supera el ${PORCENTAJE_MAXIMO_DESCUENTO}% del líquido pagable ` +
          `(máximo Bs ${limite.toFixed(2)}). Aumente el número de cuotas o reduzca el monto.`,
      },
    ]);
  }
  return { porcentaje_cuota: Math.round((maxima / liquidoPagable) * 10000) / 100, limite };
}

module.exports = {
  TIPOS,
  MAX_CUOTAS,
  PORCENTAJE_MAXIMO_DESCUENTO,
  validarDatosPrestamo,
  calcularCuotas,
  cuotaMaxima,
  validarTopeDescuento,
};
