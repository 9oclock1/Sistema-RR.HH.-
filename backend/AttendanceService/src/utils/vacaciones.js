const ESTADO_MOVIMIENTO = { EN_PROCESO: 1, GOZADO: 2, CANCELADO: 3 };

// Escala legal (Ley General del Trabajo, art. 44): días hábiles por año según los años de servicio cumplidos.
const ESCALA = [
  { desdeAnios: 11, dias: 30 },
  { desdeAnios: 6, dias: 20 },
  { desdeAnios: 1, dias: 15 },
];

// Antes del primer año de servicio no se gana ningún día.
const diasPorAnio = (aniosCumplidos) => ESCALA.find((tramo) => aniosCumplidos >= tramo.desdeAnios)?.dias ?? 0;

// Aniversario número k de AAAA-MM-DD; el 29 de febrero cae el 28 en los años no bisiestos.
function aniversario(fecha, k) {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(anio + k, mes, 0)).getUTCDate();
  return new Date(Date.UTC(anio + k, mes - 1, Math.min(dia, ultimoDia))).toISOString().slice(0, 10);
}

// Cada aniversario cumplido acredita un período con los días que corresponden a esos años de servicio.
function periodosAcreditados(fechaIngreso, hoy) {
  const periodos = [];
  for (let k = 1; aniversario(fechaIngreso, k) <= hoy; k++) {
    periodos.push({ numero: k, fecha_acreditacion: aniversario(fechaIngreso, k), dias: diasPorAnio(k) });
  }
  return periodos;
}

const sumarDias = (movimientos, idEstado) =>
  movimientos.filter((m) => m.id_estado_movimiento === idEstado).reduce((total, m) => total + m.dias, 0);

// Saldo neto = acumulados - gozados - en proceso. Los movimientos cancelados no cuentan.
function calcularSaldo(fechaIngreso, hoy, movimientos = []) {
  const periodos = periodosAcreditados(fechaIngreso, hoy);
  const acumulados = periodos.reduce((total, p) => total + p.dias, 0);
  const gozados = sumarDias(movimientos, ESTADO_MOVIMIENTO.GOZADO);
  const enProceso = sumarDias(movimientos, ESTADO_MOVIMIENTO.EN_PROCESO);
  const aniosServicio = periodos.length;
  const fechaProximo = aniversario(fechaIngreso, aniosServicio + 1);

  return {
    anios_servicio: aniosServicio,
    dias_anuales: diasPorAnio(aniosServicio),
    proximo_periodo: { fecha_acreditacion: fechaProximo, dias: diasPorAnio(aniosServicio + 1) },
    saldo: { acumulados, gozados, en_proceso: enProceso, disponibles: acumulados - gozados - enProceso },
    periodos,
  };
}

// Bolivia: UTC-4 sin horario de verano.
const fechaBolivia = (ahora = new Date()) => new Date(ahora.getTime() - 4 * 60 * 60 * 1000).toISOString().slice(0, 10);

module.exports = { ESTADO_MOVIMIENTO, diasPorAnio, aniversario, periodosAcreditados, calcularSaldo, fechaBolivia };
