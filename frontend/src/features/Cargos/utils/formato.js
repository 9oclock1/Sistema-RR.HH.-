const formatoBs = new Intl.NumberFormat('es-BO', { style: 'currency', currency: 'BOB', maximumFractionDigits: 2 });
const formatoFecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'medium' });
const formatoHora = new Intl.DateTimeFormat('es-BO', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

export const formatearMonto = (valor) => (valor === null || valor === undefined ? null : formatoBs.format(Number(valor)));

// fecha_modificacion llega como timestamp ISO (TIMESTAMPTZ); se muestra en la hora local del navegador.
// Fecha y hora por separado para obtener «27 sept de 2026, 14:30» (con hourCycle en un solo formato se pierde el «de»).
export const formatearFechaHora = (valor) => {
  if (!valor) return null;
  const fecha = new Date(valor);
  return `${formatoFecha.format(fecha)}, ${formatoHora.format(fecha)}`;
};
