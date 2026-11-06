// Puntaje ponderado de una evaluación, en una escala de 0 a 100.
//
//   puntaje = 100 × Σ(peso × valor / máximo) / Σ(peso)      sobre las preguntas RESPONDIDAS
//
// Una pregunta opcional sin responder no entra en la suma, así que su peso se reparte entre las respondidas.
// Se calcula con enteros (BigInt) y se redondea una sola vez al final, para que el resultado no dependa
// de errores de coma flotante: 79 / 90 siempre da 87.78 y un .005 exacto siempre sube.

const aCentesimas = (numero) => BigInt(Math.round(numero * 100));

// items: [{ peso, valor, maximo }] con el peso en %, el valor del nivel elegido y el valor máximo de su escala.
// Devuelve el puntaje con 2 decimales, o null si no hay nada que calcular.
function calcularPuntaje(items) {
  if (!Array.isArray(items) || items.length === 0) return null;

  // Se agrupa por máximo para sumar fracciones con pocos denominadores distintos: Σ(peso × valor) / máximo.
  const porMaximo = new Map();
  let pesoTotal = 0n;
  for (const { peso, valor, maximo } of items) {
    const p = aCentesimas(peso);
    const v = aCentesimas(valor);
    const m = aCentesimas(maximo);
    if (m <= 0n)
      throw new RangeError(
        "El valor máximo de la escala debe ser mayor que cero.",
      );
    porMaximo.set(m, (porMaximo.get(m) ?? 0n) + p * v);
    pesoTotal += p;
  }
  if (pesoTotal <= 0n) return null;

  // Σ(sumaPesoValor / m) con denominador común D = Π m.
  let numerador = 0n;
  let denominador = 1n;
  for (const [m, sumaPesoValor] of porMaximo) {
    numerador = numerador * m + sumaPesoValor * denominador;
    denominador *= m;
  }

  // puntaje × 100 (2 decimales) = 100 × 100 × numerador / (denominador × pesoTotal), con redondeo half-up.
  const divisor = denominador * pesoTotal;
  const centesimas = (2n * 10000n * numerador + divisor) / (2n * divisor);
  return Number(centesimas) / 100;
}

module.exports = { calcularPuntaje };
