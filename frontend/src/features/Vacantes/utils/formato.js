// Las fechas llegan como 'AAAA-MM-DD' (sin hora): se formatean en UTC para que no se corran un día.
const formatoFecha = new Intl.DateTimeFormat('es-BO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export const formatearFecha = (fecha) => (fecha ? formatoFecha.format(new Date(`${fecha}T00:00:00Z`)) : null);

export const formatearAnios = (anios) => {
  const numero = Number(anios);
  if (numero === 0) return 'Sin experiencia';
  return `${numero} ${numero === 1 ? 'año' : 'años'}`;
};
