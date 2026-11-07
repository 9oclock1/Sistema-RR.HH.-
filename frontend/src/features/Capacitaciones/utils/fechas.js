const dosDigitos = (numero) => String(numero).padStart(2, '0');

export const fechaDeHoy = () => {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${dosDigitos(hoy.getMonth() + 1)}-${dosDigitos(hoy.getDate())}`;
};

export const sumarMeses = (fecha, meses) => {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const indice = mes - 1 + meses;
  const anioDestino = anio + Math.floor(indice / 12);
  const mesDestino = ((indice % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anioDestino, mesDestino + 1, 0)).getUTCDate();
  return `${anioDestino}-${dosDigitos(mesDestino + 1)}-${dosDigitos(Math.min(dia, ultimoDia))}`;
};

export const describirMeses = (meses) => {
  if (meses % 12 === 0) {
    const anios = meses / 12;
    return `${anios} ${anios === 1 ? 'año' : 'años'}`;
  }
  return `${meses} meses`;
};
