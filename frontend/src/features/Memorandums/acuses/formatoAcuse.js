// Presentación del estado del acuse de recibo (RF-39), compartida por el portal del colaborador y la vista de RRHH.
export const ESTADOS_ACUSE = {
  PENDIENTE: { etiqueta: 'Pendiente de acuse', tono: 'aviso' },
  RECIBIDO: { etiqueta: 'Notificado y Recibido', tono: 'exito' },
  VENCIDO: { etiqueta: 'Sin acuse · plazo vencido', tono: 'peligro' },
};

export const estadoAcuse = (codigo) => ESTADOS_ACUSE[codigo] ?? { etiqueta: codigo, tono: 'neutral' };

const fechaHora = new Intl.DateTimeFormat('es-BO', {
  timeZone: 'America/La_Paz',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const fecha = new Intl.DateTimeFormat('es-BO', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' });

export const formatearFechaHora = (iso) => (iso ? fechaHora.format(new Date(iso)) : '—');

// fecha_emision llega como 'AAAA-MM-DD' (sin hora).
export const formatearFecha = (texto) => (texto ? fecha.format(new Date(`${texto}T00:00:00Z`)) : '—');

export const claseMemorandum = (memo) => (memo.es_reconocimiento ? 'Felicitación' : 'Llamada de atención');
