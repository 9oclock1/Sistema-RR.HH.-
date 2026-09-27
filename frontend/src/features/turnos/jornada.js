const MINUTOS_DIA = 24 * 60;

const aMinutos = (hora) => {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
};

const dosDigitos = (n) => String(n).padStart(2, "0");

export const horaCorta = (hora) => hora.slice(0, 5);

export const minutosDuracion = (inicio, fin) => (aMinutos(fin) - aMinutos(inicio) + MINUTOS_DIA) % MINUTOS_DIA;

export const cruzaMedianoche = (inicio, fin) => aMinutos(fin) < aMinutos(inicio);

export const sumarMinutos = (hora, minutos) => {
  const total = (aMinutos(hora) + minutos) % MINUTOS_DIA;
  return `${dosDigitos(Math.floor(total / 60))}:${dosDigitos(total % 60)}`;
};

export const formatearMinutos = (minutos) => {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};
