const formatoBs = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 0 });
const formatoDia = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' });
const formatoHora = new Intl.DateTimeFormat('es-BO', { timeStyle: 'short' });

export const formatearMonto = (valor) => (valor === null || valor === undefined ? null : formatoBs.format(Number(valor)));

export const formatearRangoSalarial = (nivel) => {
  if (!nivel) return '';
  const base = formatearMonto(nivel.salario_base);
  const max = formatearMonto(nivel.salario_max);
  return max ? `${base} – ${max}` : `desde ${base}`;
};

export const formatearFecha = (valor) => {
  if (!valor) return null;
  const fecha = new Date(valor);
  return { dia: formatoDia.format(fecha), hora: formatoHora.format(fecha) };
};
