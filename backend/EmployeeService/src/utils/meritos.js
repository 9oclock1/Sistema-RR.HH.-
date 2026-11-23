// KAN-81: validación de méritos de una postulación a una convocatoria interna de ascenso.

const ESTADO_POSTULACION = { PENDIENTE: 'PENDIENTE_VALIDACION', APTO: 'APTO', NO_APTO: 'NO_APTO' };

// Puntaje de méritos de los aptos (0 a 100): pesa más el desempeño reciente que la antigüedad, y la antigüedad deja
// de sumar a partir de los 5 años para que no desplace al desempeño.
const PESO_NOTA = 0.7;
const PESO_ANTIGUEDAD = 0.3;
const MESES_ANTIGUEDAD_TOPE = 60;

const redondear = (valor) => Math.round(valor * 100) / 100;

// Meses calendario completos entre dos fechas AAAA-MM-DD (el mes cuenta recién cuando llega el mismo día del mes).
function mesesCompletos(desde, hasta) {
  const [a1, m1, d1] = desde.split('-').map(Number);
  const [a2, m2, d2] = hasta.split('-').map(Number);
  let meses = (a2 - a1) * 12 + (m2 - m1);
  if (d2 < d1) meses -= 1;
  return Math.max(0, meses);
}

const describirMeses = (meses) => `${meses} ${meses === 1 ? 'mes' : 'meses'}`;
const formatearNota = (nota) => Number(nota).toFixed(2).replace(/\.?0+$/, '');

function puntajeMeritos(nota, meses) {
  const antiguedad = (Math.min(meses, MESES_ANTIGUEDAD_TOPE) / MESES_ANTIGUEDAD_TOPE) * 100;
  return redondear(PESO_NOTA * Number(nota) + PESO_ANTIGUEDAD * antiguedad);
}

// Criterios 2 y 3: compara la permanencia y la nota de la última evaluación con los mínimos de la convocatoria. Si algo
// no se cumple, la postulación queda NO_APTO con un motivo por cada requisito incumplido.
function evaluarRequisitos({ meses, ultimaEvaluacion }, { meses_antiguedad_minima: mesesMinimos, nota_minima_desempeno: notaMinima }) {
  const motivos = [];
  const cumpleAntiguedad = meses >= mesesMinimos;
  if (!cumpleAntiguedad) {
    motivos.push(`Permanencia insuficiente: tiene ${describirMeses(meses)} y la convocatoria exige ${describirMeses(mesesMinimos)}.`);
  }

  const nota = ultimaEvaluacion?.nota ?? null;
  let cumpleNota = false;
  if (nota === null) {
    motivos.push('No tiene evaluaciones de desempeño cerradas: no hay una nota que comparar con la mínima.');
  } else {
    cumpleNota = Number(nota) >= Number(notaMinima);
    if (!cumpleNota) {
      motivos.push(
        `Nota de la última evaluación insuficiente: obtuvo ${formatearNota(nota)} (${ultimaEvaluacion.ciclo}) y la mínima es ${formatearNota(notaMinima)}.`
      );
    }
  }

  const apto = cumpleAntiguedad && cumpleNota;
  return {
    estado: apto ? ESTADO_POSTULACION.APTO : ESTADO_POSTULACION.NO_APTO,
    meses_permanencia: meses,
    cumple_antiguedad: cumpleAntiguedad,
    nota_ultima_evaluacion: nota === null ? null : Number(nota),
    ciclo_ultima_evaluacion: ultimaEvaluacion?.ciclo ?? null,
    cumple_nota_evaluacion: cumpleNota,
    puntaje_meritos: apto ? puntajeMeritos(nota, meses) : null,
    motivos_no_apto: apto ? null : motivos,
  };
}

// Criterio 4: aptos del mayor al menor puntaje; a igual puntaje, mejor nota, luego más antigüedad y luego quien se
// postuló primero.
function ordenarRanking(aptos) {
  return [...aptos]
    .sort(
      (a, b) =>
        b.puntaje_meritos - a.puntaje_meritos ||
        b.nota_ultima_evaluacion - a.nota_ultima_evaluacion ||
        b.meses_permanencia - a.meses_permanencia ||
        String(a.fecha_postulacion).localeCompare(String(b.fecha_postulacion))
    )
    .map((postulacion, indice) => ({ ...postulacion, posicion: indice + 1 }));
}

module.exports = {
  ESTADO_POSTULACION,
  PESO_NOTA,
  PESO_ANTIGUEDAD,
  MESES_ANTIGUEDAD_TOPE,
  mesesCompletos,
  puntajeMeritos,
  evaluarRequisitos,
  ordenarRanking,
};
