const PERIODO_ROL = { SEMANAL: 1, MENSUAL: 2 };
const ESTADO_ROL = { BORRADOR: 1, PUBLICADO: 2 };

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const aFecha = (texto) => new Date(`${texto}T00:00:00Z`);
const aTexto = (fecha) => fecha.toISOString().slice(0, 10);

const esFechaValida = (texto) => typeof texto === "string" && FECHA_RE.test(texto) && aTexto(aFecha(texto)) === texto;

function sumarDias(texto, dias) {
  const fecha = aFecha(texto);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return aTexto(fecha);
}

// Semanal: de lunes a domingo. Mensual: del 1 al último día del mes.
function calcularPeriodo(codigo, texto) {
  const fecha = aFecha(texto);
  if (codigo === "SEMANAL") {
    const desdeLunes = (fecha.getUTCDay() + 6) % 7;
    const inicio = sumarDias(texto, -desdeLunes);
    return { fecha_inicio: inicio, fecha_fin: sumarDias(inicio, 6) };
  }
  const anio = fecha.getUTCFullYear();
  const mes = fecha.getUTCMonth();
  return {
    fecha_inicio: aTexto(new Date(Date.UTC(anio, mes, 1))),
    fecha_fin: aTexto(new Date(Date.UTC(anio, mes + 1, 0))),
  };
}

function diasDelPeriodo(inicio, fin) {
  const dias = [];
  for (let dia = inicio; dia <= fin; dia = sumarDias(dia, 1)) dias.push(dia);
  return dias;
}

module.exports = { PERIODO_ROL, ESTADO_ROL, esFechaValida, sumarDias, calcularPeriodo, diasDelPeriodo };
