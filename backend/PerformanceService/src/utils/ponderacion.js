// Los pesos se suman en centésimas para que 33.33 + 33.33 + 33.34 dé exactamente 100.
const aCentesimas = (valor) => Math.round(valor * 100);

const PESO_TOTAL = 100;

const preguntasDe = (secciones) =>
  secciones.flatMap((seccion) => seccion.criterios).flatMap((criterio) => criterio.preguntas);

const sumar = (preguntas) =>
  preguntas.reduce((total, pregunta) => total + aCentesimas(pregunta.peso_porcentual), 0) / 100;

function balancePesos(secciones) {
  const centesimas = aCentesimas(sumar(preguntasDe(secciones)));
  return {
    suma: centesimas / 100,
    diferencia: (aCentesimas(PESO_TOTAL) - centesimas) / 100,
    balanceado: centesimas === aCentesimas(PESO_TOTAL),
  };
}

const pesoCriterio = (criterio) => sumar(criterio.preguntas);

const pesoSeccion = (seccion) => sumar(seccion.criterios.flatMap((criterio) => criterio.preguntas));

function describirDesbalance({ suma, diferencia }) {
  const porcentaje = (valor) => `${Number(valor.toFixed(2))} %`;
  return diferencia > 0
    ? `La suma de pesos es ${porcentaje(suma)}: faltan ${porcentaje(diferencia)} para llegar a 100 %.`
    : `La suma de pesos es ${porcentaje(suma)}: sobran ${porcentaje(-diferencia)} sobre 100 %.`;
}

module.exports = { PESO_TOTAL, aCentesimas, balancePesos, pesoCriterio, pesoSeccion, describirDesbalance };
