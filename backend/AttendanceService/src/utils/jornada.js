const SEGUNDOS_DIA = 24 * 60 * 60;
// Bolivia: UTC-4 sin horario de verano.
const DESFASE_UTC_MS = 4 * 60 * 60 * 1000;

const aSegundos = (hora) => {
  const [h, m, s = 0] = hora.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

const minutosDuracion = ({ hora_inicio, hora_fin }) =>
  ((aSegundos(hora_fin) - aSegundos(hora_inicio) + SEGUNDOS_DIA) % SEGUNDOS_DIA) / 60;

const minutosEfectivos = (turno) => minutosDuracion(turno) - turno.minutos_refrigerio;

function evaluarPuntualidad(turno, fechaJornada, marcaje) {
  const [anio, mes, dia] = fechaJornada.split("-").map(Number);
  const inicioMs = Date.UTC(anio, mes - 1, dia) + aSegundos(turno.hora_inicio) * 1000 + DESFASE_UTC_MS;
  const limiteMs = inicioMs + turno.minutos_tolerancia * 60 * 1000;
  const marcajeMs = marcaje.getTime();
  const puntual = marcajeMs <= limiteMs;

  return {
    puntual,
    minutos_atraso: puntual ? 0 : Math.ceil((marcajeMs - inicioMs) / 60000),
    inicio_programado: new Date(inicioMs).toISOString(),
    limite_puntualidad: new Date(limiteMs).toISOString(),
  };
}

const horaBolivia = (fecha) => new Date(fecha.getTime() - DESFASE_UTC_MS).toISOString().slice(11, 16);

module.exports = { minutosDuracion, minutosEfectivos, evaluarPuntualidad, horaBolivia };
