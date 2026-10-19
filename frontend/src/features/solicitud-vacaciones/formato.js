// Las fechas llegan como AAAA-MM-DD; se formatean en UTC para no correr el día.
const fechaMedia = new Intl.DateTimeFormat("es-BO", { timeZone: "UTC", dateStyle: "medium" });
const fechaConDia = new Intl.DateTimeFormat("es-BO", {
  timeZone: "UTC",
  weekday: "short",
  day: "numeric",
  month: "short",
});

export const formatearFecha = (texto) => fechaMedia.format(new Date(`${texto}T00:00:00Z`));

export const formatearFechaConDia = (texto) => fechaConDia.format(new Date(`${texto}T00:00:00Z`));

export const formatearPeriodo = (inicio, fin) =>
  inicio === fin ? formatearFecha(inicio) : `${formatearFecha(inicio)} – ${formatearFecha(fin)}`;

export const plural = (cantidad, singular, varios) => `${cantidad} ${cantidad === 1 ? singular : varios}`;

export const ESTADOS = {
  PENDIENTE: { tono: "aviso", texto: "Pendiente" },
  APROBADA: { tono: "exito", texto: "Aprobada" },
  RECHAZADA: { tono: "peligro", texto: "Rechazada" },
  CANCELADA: { tono: "neutral", texto: "Cancelada" },
};

export const TITULOS_PROBLEMA = {
  SALDO_INSUFICIENTE: "Saldo insuficiente",
  CONFLICTO_FECHAS: "Conflicto de fechas",
  ANTICIPACION_INSUFICIENTE: "Anticipación insuficiente",
  SIN_DIAS_HABILES: "Sin días hábiles",
};
